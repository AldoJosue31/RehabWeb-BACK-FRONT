import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class PerfilClinico(models.Model):
    NIVEL_MOVILIDAD_CHOICES = [
        ('bajo', 'Bajo'),
        ('medio', 'Medio'),
        ('alto', 'Alto'),
        ('dependiente', 'Dependiente'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    diagnostico_principal = models.CharField(max_length=180)
    historial_medico = models.TextField(blank=True)
    nivel_movilidad = models.CharField(max_length=20, choices=NIVEL_MOVILIDAD_CHOICES, default='medio')
    restricciones = models.TextField(blank=True)
    evaluacion_inicial_registrada = models.BooleanField(default=False)

    def __str__(self):
        return self.diagnostico_principal


class TerapeutaProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name='perfil_terapeuta',
        on_delete=models.CASCADE,
    )
    especialidad = models.CharField(max_length=120)
    numero_licencia = models.CharField(max_length=80, unique=True)

    def __str__(self):
        return f'{self.usuario.get_full_name() or self.usuario.username} - {self.especialidad}'


class PacienteProfile(models.Model):
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('inactivo', 'Inactivo'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name='perfil_paciente',
        on_delete=models.CASCADE,
    )
    terapeuta = models.ForeignKey(
        TerapeutaProfile,
        related_name='pacientes',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    perfil_clinico = models.OneToOneField(
        PerfilClinico,
        related_name='paciente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    fecha_nacimiento = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activo')
    estrategia_validacion = models.CharField(max_length=120, default='Libre')
    estrategia_progreso = models.CharField(max_length=120, default='Por rutinas')

    def __str__(self):
        return self.usuario.get_full_name() or self.usuario.username


class Alert(models.Model):
    TYPE_INACTIVITY_WARNING = 'INACTIVITY_WARNING'
    TYPE_PAIN_OR_DETERIORATION = 'PAIN_OR_DETERIORATION'

    ALERT_TYPE_CHOICES = [
        (TYPE_INACTIVITY_WARNING, 'Inactividad'),
        (TYPE_PAIN_OR_DETERIORATION, 'Dolor o deterioro'),
    ]

    STATUS_ACTIVE = 'activa'
    STATUS_REVIEWED = 'revisada'
    STATUS_RESOLVED = 'resuelta'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Activa'),
        (STATUS_REVIEWED, 'Revisada'),
        (STATUS_RESOLVED, 'Resuelta'),
    ]

    SEVERITY_CHOICES = [
        ('warning', 'Advertencia'),
        ('critical', 'Critica'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='alertas_como_paciente',
        on_delete=models.CASCADE,
    )
    terapeuta = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='alertas_como_terapeuta',
        on_delete=models.CASCADE,
    )
    alert_type = models.CharField(max_length=40, choices=ALERT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    title = models.CharField(max_length=160)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    detected_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    source_session = models.ForeignKey(
        'ExerciseSession',
        related_name='generated_alerts',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['-detected_at']

    def __str__(self):
        return f'{self.alert_type} - {self.paciente}'


class MotivationProfile(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name='motivacion',
        on_delete=models.CASCADE,
    )
    total_points = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    best_streak = models.PositiveIntegerField(default=0)
    last_session_date = models.DateField(null=True, blank=True)
    leaderboard_opt_in = models.BooleanField(default=False)
    leaderboard_consented_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Motivacion {self.usuario}'


class ExerciseSession(models.Model):
    paciente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='sesiones_rehabilitacion',
        on_delete=models.CASCADE,
    )
    terapeuta = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='sesiones_supervisadas',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    performed_at = models.DateTimeField(default=timezone.now)
    scheduled_for = models.DateField(null=True, blank=True)
    exercise_name = models.CharField(max_length=140, default='Sesion de rehabilitacion')
    repetitions_completed = models.PositiveIntegerField(default=0)
    planned_repetitions = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    planned_duration_seconds = models.PositiveIntegerField(default=0)
    pain_level = models.PositiveSmallIntegerField(default=0)
    mobility_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    speed_bonus_points = models.PositiveIntegerField(default=0)
    streak_days = models.PositiveIntegerField(default=0)
    positive_feedback = models.CharField(max_length=180, blank=True)
    performance_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-performed_at']

    def __str__(self):
        return f'{self.exercise_name} - {self.paciente}'


class Exercise(models.Model):
    MOBILITY_CHOICES = PerfilClinico.NIVEL_MOVILIDAD_CHOICES

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80, default='Movilidad')
    compatible_diagnoses = models.TextField(blank=True)
    contraindications = models.TextField(blank=True)
    min_mobility_level = models.CharField(max_length=20, choices=MOBILITY_CHOICES, default='bajo')
    default_sets = models.PositiveSmallIntegerField(default=3)
    default_repetitions = models.PositiveIntegerField(default=10)
    default_rest_seconds = models.PositiveIntegerField(default=60)
    default_duration_seconds = models.PositiveIntegerField(default=600)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return self.name


class Routine(models.Model):
    STATUS_DRAFT = 'borrador'
    STATUS_VALIDATED = 'validada'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Borrador'),
        (STATUS_VALIDATED, 'Validada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    terapeuta = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='rutinas_creadas',
        on_delete=models.CASCADE,
    )
    paciente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='rutinas_recibidas',
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    version = models.CharField(max_length=20, default='1.0')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_VALIDATED)
    estimated_duration_seconds = models.PositiveIntegerField(default=0)
    validation_warnings = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} v{self.version}'


class RoutineExercise(models.Model):
    routine = models.ForeignKey(Routine, related_name='items', on_delete=models.CASCADE)
    exercise = models.ForeignKey(Exercise, related_name='routine_items', on_delete=models.PROTECT)
    order = models.PositiveSmallIntegerField(default=1)
    sets = models.PositiveSmallIntegerField(default=3)
    repetitions = models.PositiveIntegerField(default=10)
    rest_seconds = models.PositiveIntegerField(default=60)
    duration_seconds = models.PositiveIntegerField(default=600)
    notes = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.routine} - {self.exercise}'


class RoutineTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    terapeuta = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='plantillas_rutina',
        on_delete=models.CASCADE,
    )
    source_routine = models.ForeignKey(
        Routine,
        related_name='templates',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=160)
    clinical_tags = models.CharField(max_length=260, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class RoutineAssignment(models.Model):
    STATUS_ASSIGNED = 'asignada'
    STATUS_ACTIVE = 'activa'
    STATUS_COMPLETED = 'completada'
    STATUS_CANCELLED = 'cancelada'

    STATUS_CHOICES = [
        (STATUS_ASSIGNED, 'Asignada'),
        (STATUS_ACTIVE, 'Activa'),
        (STATUS_COMPLETED, 'Completada'),
        (STATUS_CANCELLED, 'Cancelada'),
    ]

    FREQUENCY_CHOICES = [
        ('diaria', 'Diaria'),
        ('3_semana', '3 veces por semana'),
        ('2_semana', '2 veces por semana'),
        ('semanal', 'Semanal'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    routine = models.ForeignKey(Routine, related_name='assignments', on_delete=models.CASCADE)
    paciente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='asignaciones_rutina',
        on_delete=models.CASCADE,
    )
    terapeuta = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='asignaciones_creadas',
        on_delete=models.CASCADE,
    )
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='diaria')
    preferred_times = models.CharField(max_length=120, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    total_weeks = models.PositiveSmallIntegerField(default=12)
    special_instructions = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ASSIGNED)
    assigned_at = models.DateTimeField(default=timezone.now)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-assigned_at']

    def __str__(self):
        return f'{self.routine} -> {self.paciente}'


class Notification(models.Model):
    TYPE_ROUTINE_ASSIGNED = 'routine_assigned'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='notificaciones',
        on_delete=models.CASCADE,
    )
    title = models.CharField(max_length=160)
    message = models.TextField()
    notification_type = models.CharField(max_length=60, default=TYPE_ROUTINE_ASSIGNED)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} - {self.recipient}'


class PatientBadge(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='insignias',
        on_delete=models.CASCADE,
    )
    code = models.CharField(max_length=60)
    name = models.CharField(max_length=120)
    description = models.CharField(max_length=240)
    awarded_at = models.DateTimeField(default=timezone.now)
    source_session = models.ForeignKey(
        ExerciseSession,
        related_name='badges_awarded',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['-awarded_at']
        unique_together = ('usuario', 'code')

    def __str__(self):
        return f'{self.name} - {self.usuario}'


class WeeklySummary(models.Model):
    paciente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='resumenes_semanales',
        on_delete=models.CASCADE,
    )
    week_start = models.DateField()
    week_end = models.DateField()
    sessions_completed = models.PositiveIntegerField(default=0)
    sessions_scheduled = models.PositiveIntegerField(default=0)
    points_obtained = models.PositiveIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-week_start']
        unique_together = ('paciente', 'week_start')

    def __str__(self):
        return f'Resumen {self.paciente} {self.week_start}'
