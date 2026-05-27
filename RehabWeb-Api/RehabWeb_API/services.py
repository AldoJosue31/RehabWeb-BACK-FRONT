from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum
from django.utils import timezone

from RehabWeb_API.models import (
    Alert,
    Exercise,
    ExerciseSession,
    MotivationProfile,
    Notification,
    PacienteProfile,
    PatientBadge,
    RoutineAssignment,
    WeeklySummary,
)


BADGES = {
    'FIRST_SESSION': ('Primer Paso', 'Celebra el inicio de su viaje.'),
    'STREAK_3': ('Constancia 3 dias', 'Completo sesiones durante 3 dias seguidos.'),
    'STREAK_7': ('Semana Completa', 'Completo 7 sesiones consecutivas.'),
    'STREAK_30': ('Mes Dedicado', 'Completo 30 sesiones consecutivas.'),
    'POINTS_100': ('Fortaleza', 'Acumulo sus primeros 100 puntos.'),
    'POINTS_500': ('Superestrella', 'Acumulo 500 puntos.'),
    'HIGH_REPS_100': ('100 repeticiones', 'Completo 100 repeticiones en una sesion.'),
    'SPEED_20': ('Velocidad', 'Completo una sesion al menos 20% mas rapido.'),
    'COGNITIVE_5': ('Cerebro Ganador', 'Completo ejercicios cognitivos 5 veces.'),
}

MOTIVATION_LEVELS = [
    {
        'name': 'Novato',
        'min_points': 0,
        'max_points': 499,
        'color': '#78909C',
        'description': 'Dando los primeros pasos',
    },
    {
        'name': 'Perseverante',
        'min_points': 500,
        'max_points': 1499,
        'color': '#29B6F6',
        'description': 'La constancia te define',
    },
    {
        'name': 'Guerrero',
        'min_points': 1500,
        'max_points': 3499,
        'color': '#AB47BC',
        'description': 'Forjado en el esfuerzo',
    },
    {
        'name': 'Maestro',
        'min_points': 3500,
        'max_points': 7499,
        'color': '#FFA726',
        'description': 'Dominas tu recuperacion',
    },
    {
        'name': 'Leyenda',
        'min_points': 7500,
        'max_points': None,
        'color': '#EF5350',
        'description': 'Inspiracion para todos',
    },
]

MOBILITY_ORDER = {
    'dependiente': 0,
    'bajo': 1,
    'medio': 2,
    'alto': 3,
}


def therapist_for_patient(patient):
    profile = getattr(patient, 'perfil_paciente', None)
    return profile.terapeuta.usuario if profile and profile.terapeuta else None


def notify_alert(alert):
    if not alert.terapeuta.email:
        return

    send_mail(
        subject=f'RehabWeb: {alert.title}',
        message=alert.message,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'rehabweb@localhost'),
        recipient_list=[alert.terapeuta.email],
        fail_silently=True,
    )


def is_minor(patient, today=None):
    profile = getattr(patient, 'perfil_paciente', None)
    birth_date = profile.fecha_nacimiento if profile else None
    if not birth_date:
        return False

    today = today or timezone.localdate()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return age < 18


def patient_age(patient, today=None):
    profile = getattr(patient, 'perfil_paciente', None)
    birth_date = profile.fecha_nacimiento if profile else None
    if not birth_date:
        return None

    today = today or timezone.localdate()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def patient_has_initial_evaluation(patient):
    profile = getattr(patient, 'perfil_paciente', None)
    clinical_profile = profile.perfil_clinico if profile else None
    if not clinical_profile:
        return False

    diagnosis = (clinical_profile.diagnostico_principal or '').strip().lower()
    has_real_diagnosis = diagnosis and diagnosis != 'sin diagnostico registrado'
    return bool(has_real_diagnosis and (clinical_profile.evaluacion_inicial_registrada or clinical_profile.historial_medico or clinical_profile.restricciones or clinical_profile.nivel_movilidad))


def clinical_text_for_patient(patient):
    profile = getattr(patient, 'perfil_paciente', None)
    clinical_profile = profile.perfil_clinico if profile else None
    if not clinical_profile:
        return ''

    parts = [
        clinical_profile.diagnostico_principal,
        clinical_profile.historial_medico,
        clinical_profile.restricciones,
        profile.estrategia_validacion if profile else '',
    ]
    return ' '.join(part for part in parts if part).lower()


def split_terms(value):
    return [term.strip().lower() for term in (value or '').replace(';', ',').split(',') if term.strip()]


def exercise_matches_patient_profile(exercise, patient):
    profile = getattr(patient, 'perfil_paciente', None)
    clinical_profile = profile.perfil_clinico if profile else None
    if not clinical_profile:
        return False

    patient_mobility = MOBILITY_ORDER.get(clinical_profile.nivel_movilidad, 2)
    exercise_mobility = MOBILITY_ORDER.get(exercise.min_mobility_level, 1)
    if patient_mobility < exercise_mobility:
        return False

    clinical_text = clinical_text_for_patient(patient)
    contraindications = split_terms(exercise.contraindications)
    if contraindications and any(term in clinical_text for term in contraindications):
        return False

    compatible_terms = split_terms(exercise.compatible_diagnoses)
    if not compatible_terms:
        return True

    if any(term in ('general', 'todos', 'libre') for term in compatible_terms):
        return True

    return any(term in clinical_text for term in compatible_terms)


def compatible_exercises_for_patient(patient):
    return [
        exercise
        for exercise in Exercise.objects.filter(active=True)
        if exercise_matches_patient_profile(exercise, patient)
    ]


def validate_routine_item_for_patient(exercise, patient, item_data):
    warnings = []
    profile = getattr(patient, 'perfil_paciente', None)
    clinical_profile = profile.perfil_clinico if profile else None
    clinical_text = clinical_text_for_patient(patient)
    repetitions = int(item_data.get('repetitions') or exercise.default_repetitions or 0)
    sets = int(item_data.get('sets') or exercise.default_sets or 0)
    duration_seconds = int(item_data.get('duration_seconds') or exercise.default_duration_seconds or 0)

    if not clinical_profile:
        warnings.append('El paciente no tiene perfil clinico completo.')
        return warnings

    if not exercise_matches_patient_profile(exercise, patient):
        warnings.append(f'{exercise.name} no coincide con el perfil clinico o restricciones del paciente.')

    age = patient_age(patient)
    if age is not None and age >= 65:
        if repetitions * sets > 60:
            warnings.append(f'{exercise.name}: volumen alto para adulto mayor.')
        if duration_seconds > 1200:
            warnings.append(f'{exercise.name}: duracion prolongada para adulto mayor.')

    has_quadriplegia = any(term in clinical_text for term in ['cuadriplejia', 'quadriplejia', 'quadriplegia', 'tetraplejia'])
    if has_quadriplegia:
        if clinical_profile.nivel_movilidad != 'dependiente':
            warnings.append('El perfil sugiere cuadriplejia; revisa que el nivel de movilidad sea dependiente.')
        if exercise.min_mobility_level in ('medio', 'alto'):
            warnings.append(f'{exercise.name}: requiere movilidad mayor a la esperada para cuadriplejia.')
        if repetitions * sets > 30:
            warnings.append(f'{exercise.name}: volumen alto para paciente con cuadriplejia.')

    if clinical_profile.nivel_movilidad == 'dependiente' and exercise.min_mobility_level in ('medio', 'alto'):
        warnings.append(f'{exercise.name}: requiere movilidad {exercise.min_mobility_level}.')

    return warnings


def validate_routine_for_patient(patient, items):
    warnings = []
    if not patient_has_initial_evaluation(patient):
        warnings.append('El paciente debe tener perfil clinico y evaluacion inicial registrada.')

    for item in items:
        exercise = item.get('exercise')
        if exercise:
            warnings.extend(validate_routine_item_for_patient(exercise, patient, item))
    return warnings


def estimate_routine_duration(items):
    total = 0
    for item in items:
        sets = int(item.get('sets') or 0)
        repetitions = int(item.get('repetitions') or 0)
        rest_seconds = int(item.get('rest_seconds') or 0)
        duration_seconds = int(item.get('duration_seconds') or 0)
        active_seconds = duration_seconds or repetitions * 6
        total += max(sets, 1) * active_seconds
        total += max(sets - 1, 0) * rest_seconds
    return total


def create_assignment_notification(assignment):
    return Notification.objects.create(
        recipient=assignment.paciente,
        title='Nueva rutina asignada',
        message=(
            f'Tu terapeuta asigno la rutina "{assignment.routine.name}" '
            f'para iniciar el {assignment.start_date.isoformat()}.'
        ),
        notification_type=Notification.TYPE_ROUTINE_ASSIGNED,
        payload={
            'assignment_id': str(assignment.id),
            'routine_id': str(assignment.routine_id),
            'start_date': assignment.start_date.isoformat(),
        },
    )


def refresh_assignment_status(assignment, today=None):
    today = today or timezone.localdate()
    if assignment.status == RoutineAssignment.STATUS_ASSIGNED and assignment.start_date <= today:
        assignment.status = RoutineAssignment.STATUS_ACTIVE
        assignment.activated_at = timezone.now()
        assignment.save(update_fields=['status', 'activated_at'])
    return assignment


def calculate_speed_bonus(repetitions, duration_seconds, planned_duration_seconds=0):
    if not repetitions or not duration_seconds:
        return 0

    if planned_duration_seconds:
        ten_minutes_early = duration_seconds <= max(planned_duration_seconds - 600, 0)
        twenty_percent_faster = duration_seconds <= planned_duration_seconds * 0.8
        if ten_minutes_early or twenty_percent_faster:
            return max(1, round(repetitions * 0.10))
        return 0

    reps_per_minute = repetitions / max(duration_seconds / 60, 1)
    if reps_per_minute >= 30:
        return max(1, round(repetitions * 0.25))
    if reps_per_minute >= 15:
        return max(1, round(repetitions * 0.10))
    return 0


def motivation_level_for_points(points):
    points = int(points or 0)
    level = MOTIVATION_LEVELS[-1]
    for candidate in MOTIVATION_LEVELS:
        max_points = candidate['max_points']
        if points >= candidate['min_points'] and (max_points is None or points <= max_points):
            level = candidate
            break

    next_level = next(
        (
            candidate
            for candidate in MOTIVATION_LEVELS
            if candidate['min_points'] > level['min_points']
        ),
        None,
    )
    points_to_next = max(next_level['min_points'] - points, 0) if next_level else 0
    if level['max_points'] is None:
        progress = 100
    else:
        span = max(level['max_points'] - level['min_points'], 1)
        progress = round(((points - level['min_points']) / span) * 100)

    return {
        'name': level['name'],
        'color': level['color'],
        'description': level['description'],
        'progress': min(max(progress, 0), 100),
        'points_to_next': points_to_next,
    }


def streak_bonus_percent(streak_days):
    return min(50, max(0, (int(streak_days or 0) - 1) * 10))


def _hours_until_end_of_day(reference_date):
    now = timezone.localtime()
    tomorrow = reference_date + timedelta(days=1)
    deadline = timezone.make_aware(datetime.combine(tomorrow, time.min), timezone.get_current_timezone())
    seconds = max((deadline - now).total_seconds(), 0)
    return int((seconds + 3599) // 3600)


def streak_status_for_profile(profile, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    current_streak = int(profile.current_streak or 0)

    if not profile.last_session_date or current_streak == 0:
        return {
            'status': 'perdida',
            'bonus_percent': 0,
            'hours_remaining': None,
        }

    if profile.last_session_date == reference_date:
        return {
            'status': 'intacta',
            'bonus_percent': streak_bonus_percent(current_streak),
            'hours_remaining': None,
        }

    if profile.last_session_date == reference_date - timedelta(days=1):
        return {
            'status': 'en_peligro',
            'bonus_percent': streak_bonus_percent(current_streak),
            'hours_remaining': _hours_until_end_of_day(reference_date),
        }

    return {
        'status': 'perdida',
        'bonus_percent': 0,
        'hours_remaining': None,
    }


def next_session_projection(profile, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    if profile.last_session_date == reference_date:
        next_streak = profile.current_streak or 1
    elif profile.last_session_date == reference_date - timedelta(days=1):
        next_streak = (profile.current_streak or 0) + 1
    else:
        next_streak = 1

    return {
        'streak_days': next_streak,
        'streak_bonus_percent': streak_bonus_percent(next_streak),
    }


def reset_expired_streak(profile, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    if profile.last_session_date and profile.last_session_date < reference_date - timedelta(days=1):
        profile.current_streak = 0
        profile.save(update_fields=['current_streak', 'updated_at'])
    return profile.current_streak


def update_streak(profile, session_date):
    if profile.last_session_date == session_date:
        return profile.current_streak

    if profile.last_session_date == session_date - timedelta(days=1):
        profile.current_streak += 1
    else:
        profile.current_streak = 1

    profile.best_streak = max(profile.best_streak, profile.current_streak)
    profile.last_session_date = session_date
    return profile.current_streak


def feedback_for_session(session):
    if session.pain_level >= 7:
        return 'Buen trabajo reportando tu dolor; tu terapeuta fue alertado.'
    if session.repetitions_completed >= session.planned_repetitions and session.planned_repetitions:
        return 'Excelente trabajo, completaste tu objetivo.'
    if session.repetitions_completed:
        return 'Excelente trabajo, cada repeticion cuenta.'
    return 'Sesion registrada correctamente.'


def award_badge(patient, code, session):
    name, description = BADGES[code]
    return PatientBadge.objects.get_or_create(
        usuario=patient,
        code=code,
        defaults={
            'name': name,
            'description': description,
            'source_session': session,
        },
    )


def evaluate_badges(session, profile):
    created = []
    total_sessions = ExerciseSession.objects.filter(paciente=session.paciente).count()
    if total_sessions == 1:
        badge, was_created = award_badge(session.paciente, 'FIRST_SESSION', session)
        if was_created:
            created.append(badge)
    if session.streak_days >= 3:
        badge, was_created = award_badge(session.paciente, 'STREAK_3', session)
        if was_created:
            created.append(badge)
    if session.streak_days >= 7:
        badge, was_created = award_badge(session.paciente, 'STREAK_7', session)
        if was_created:
            created.append(badge)
    if session.streak_days >= 30:
        badge, was_created = award_badge(session.paciente, 'STREAK_30', session)
        if was_created:
            created.append(badge)
    if profile.total_points >= 100:
        badge, was_created = award_badge(session.paciente, 'POINTS_100', session)
        if was_created:
            created.append(badge)
    if profile.total_points >= 500:
        badge, was_created = award_badge(session.paciente, 'POINTS_500', session)
        if was_created:
            created.append(badge)
    if session.repetitions_completed >= 100:
        badge, was_created = award_badge(session.paciente, 'HIGH_REPS_100', session)
        if was_created:
            created.append(badge)
    if session.planned_duration_seconds and session.duration_seconds <= session.planned_duration_seconds * 0.8:
        badge, was_created = award_badge(session.paciente, 'SPEED_20', session)
        if was_created:
            created.append(badge)
    cognitive_sessions = ExerciseSession.objects.filter(
        paciente=session.paciente,
        exercise_name__icontains='cognitiv',
    ).count()
    if cognitive_sessions >= 5:
        badge, was_created = award_badge(session.paciente, 'COGNITIVE_5', session)
        if was_created:
            created.append(badge)
    return created


def generate_session_alerts(session):
    therapist = session.terapeuta or therapist_for_patient(session.paciente)
    if not therapist:
        return []

    alerts = []
    if session.pain_level >= 7:
        alert = Alert.objects.create(
            paciente=session.paciente,
            terapeuta=therapist,
            alert_type=Alert.TYPE_PAIN_OR_DETERIORATION,
            severity='critical',
            title='Dolor alto reportado',
            message=f'El paciente reporto dolor {session.pain_level}/10 en {session.exercise_name}.',
            source_session=session,
        )
        notify_alert(alert)
        alerts.append(alert)

    previous = ExerciseSession.objects.filter(
        paciente=session.paciente,
        mobility_score__isnull=False,
        performed_at__lt=session.performed_at,
    ).order_by('-performed_at').first()

    if previous and session.mobility_score is not None:
        previous_score = float(previous.mobility_score)
        current_score = float(session.mobility_score)
        if previous_score > 0 and current_score <= previous_score * 0.70:
            alert = Alert.objects.create(
                paciente=session.paciente,
                terapeuta=therapist,
                alert_type=Alert.TYPE_PAIN_OR_DETERIORATION,
                severity='critical',
                title='Deterioro de movilidad',
                message=f'La movilidad bajo de {previous_score:g} a {current_score:g}.',
                source_session=session,
            )
            notify_alert(alert)
            alerts.append(alert)

    return alerts


def finalize_session_metrics(session):
    profile, _ = MotivationProfile.objects.get_or_create(usuario=session.paciente)
    session_date = timezone.localdate(session.performed_at)
    speed_bonus = calculate_speed_bonus(
        session.repetitions_completed,
        session.duration_seconds,
        session.planned_duration_seconds,
    )
    streak_days = update_streak(profile, session_date)
    streak_bonus = min(0.5, max(0, (streak_days - 1) * 0.10))
    base_points = session.repetitions_completed + speed_bonus
    points = round(base_points * (1 + streak_bonus))

    session.speed_bonus_points = speed_bonus
    session.streak_days = streak_days
    session.points_awarded = points
    session.positive_feedback = feedback_for_session(session)
    if not session.performance_notes:
        session.performance_notes = (
            f'Desempeno registrado: {session.repetitions_completed}/'
            f'{session.planned_repetitions or session.repetitions_completed} repeticiones, '
            f'{session.duration_seconds} segundos, dolor {session.pain_level}/10.'
        )
    profile.total_points += points
    profile.save()
    session.save(update_fields=[
        'speed_bonus_points',
        'streak_days',
        'points_awarded',
        'positive_feedback',
        'performance_notes',
    ])

    evaluate_badges(session, profile)
    generate_session_alerts(session)
    return session


def detect_inactivity_alerts(reference_date=None):
    reference_date = reference_date or timezone.localdate()
    threshold = reference_date - timedelta(days=3)
    generated = 0

    for profile in PacienteProfile.objects.select_related('usuario', 'terapeuta__usuario').filter(terapeuta__isnull=False):
        last_session = ExerciseSession.objects.filter(paciente=profile.usuario).order_by('-performed_at').first()
        last_activity_date = timezone.localdate(last_session.performed_at) if last_session else None
        if last_activity_date and last_activity_date >= threshold:
            continue

        exists = Alert.objects.filter(
            paciente=profile.usuario,
            terapeuta=profile.terapeuta.usuario,
            alert_type=Alert.TYPE_INACTIVITY_WARNING,
            status=Alert.STATUS_ACTIVE,
        ).exists()
        if exists:
            continue

        activity_text = last_activity_date.isoformat() if last_activity_date else 'sin sesiones registradas'
        alert = Alert.objects.create(
            paciente=profile.usuario,
            terapeuta=profile.terapeuta.usuario,
            alert_type=Alert.TYPE_INACTIVITY_WARNING,
            severity='warning',
            title='Paciente sin actividad reciente',
            message=f'Ultima actividad: {activity_text}. Supera 3 dias consecutivos sin ejercicios.',
        )
        notify_alert(alert)
        generated += 1

    return generated


def build_weekly_summary(patient, week_end=None):
    week_end = week_end or timezone.localdate()
    week_start = week_end - timedelta(days=6)
    sessions = ExerciseSession.objects.filter(
        paciente=patient,
        performed_at__date__gte=week_start,
        performed_at__date__lte=week_end,
    )
    sessions_completed = sessions.count()
    points_obtained = sessions.aggregate(total=Sum('points_awarded'))['total'] or 0
    summary, _ = WeeklySummary.objects.update_or_create(
        paciente=patient,
        week_start=week_start,
        defaults={
            'week_end': week_end,
            'sessions_completed': sessions_completed,
            'sessions_scheduled': max(7, sessions_completed),
            'points_obtained': points_obtained,
            'sent_at': timezone.now() if week_end.weekday() == 6 else None,
        },
    )
    return summary


def build_and_send_weekly_summaries(reference_date=None):
    reference_date = reference_date or timezone.localdate()
    if reference_date.weekday() != 6:
        return 0

    sent = 0
    patients = PacienteProfile.objects.select_related('usuario').filter(usuario__is_active=True)
    for patient_profile in patients:
        summary = build_weekly_summary(patient_profile.usuario, reference_date)
        if patient_profile.usuario.email:
            send_mail(
                subject='RehabWeb: resumen semanal de progreso',
                message=(
                    f'Sesiones completadas: {summary.sessions_completed}/'
                    f'{summary.sessions_scheduled}. Puntos obtenidos: {summary.points_obtained}.'
                ),
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'rehabweb@localhost'),
                recipient_list=[patient_profile.usuario.email],
                fail_silently=True,
            )
        sent += 1
    return sent


def leaderboard_top10():
    expired_profiles = MotivationProfile.objects.select_related('usuario').filter(leaderboard_opt_in=True)
    for profile in expired_profiles:
        reset_expired_streak(profile)

    minor_ids = [profile.usuario_id for profile in PacienteProfile.objects.select_related('usuario')]
    eligible_profiles = []
    for profile in MotivationProfile.objects.select_related('usuario').filter(leaderboard_opt_in=True).order_by('-total_points'):
        if profile.usuario_id in minor_ids and is_minor(profile.usuario):
            continue
        eligible_profiles.append(profile)
        if len(eligible_profiles) == 10:
            break
    return eligible_profiles
