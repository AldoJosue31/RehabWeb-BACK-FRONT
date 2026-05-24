from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Sum
from django.utils import timezone

from RehabWeb_API.models import (
    Alert,
    ExerciseSession,
    MotivationProfile,
    PacienteProfile,
    PatientBadge,
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
