# Generated for therapist routine creation and patient assignments.

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


def seed_exercises(apps, schema_editor):
    Exercise = apps.get_model('RehabWeb_API', 'Exercise')
    exercises = [
        {
            'name': 'Respiracion diafragmatica guiada',
            'description': 'Control respiratorio suave con pausas breves.',
            'category': 'Respiratoria',
            'compatible_diagnoses': 'general, adulto mayor, cuadriplejia, dolor lumbar',
            'contraindications': 'crisis respiratoria aguda',
            'min_mobility_level': 'dependiente',
            'default_sets': 3,
            'default_repetitions': 8,
            'default_rest_seconds': 45,
            'default_duration_seconds': 180,
        },
        {
            'name': 'Movilizacion pasiva de hombro',
            'description': 'Rango de movimiento asistido para extremidad superior.',
            'category': 'Movilidad asistida',
            'compatible_diagnoses': 'cuadriplejia, hemiparesia, postoperatorio, adulto mayor',
            'contraindications': 'luxacion, fractura, dolor severo',
            'min_mobility_level': 'dependiente',
            'default_sets': 2,
            'default_repetitions': 10,
            'default_rest_seconds': 60,
            'default_duration_seconds': 240,
        },
        {
            'name': 'Flexion controlada de rodilla',
            'description': 'Flexion y extension con apoyo para recuperar rango articular.',
            'category': 'Movilidad',
            'compatible_diagnoses': 'rodilla, postoperatorio, adulto mayor, general',
            'contraindications': 'fractura, inflamacion aguda, dolor severo',
            'min_mobility_level': 'bajo',
            'default_sets': 3,
            'default_repetitions': 12,
            'default_rest_seconds': 60,
            'default_duration_seconds': 300,
        },
        {
            'name': 'Puente de gluteos asistido',
            'description': 'Activacion de cadena posterior en colchoneta.',
            'category': 'Fuerza',
            'compatible_diagnoses': 'dolor lumbar, cadera, general',
            'contraindications': 'cuadriplejia, dolor severo, fractura',
            'min_mobility_level': 'medio',
            'default_sets': 3,
            'default_repetitions': 10,
            'default_rest_seconds': 75,
            'default_duration_seconds': 360,
        },
        {
            'name': 'Marcha estacionaria con apoyo',
            'description': 'Trabajo de equilibrio y tolerancia a la carga.',
            'category': 'Marcha',
            'compatible_diagnoses': 'marcha, rodilla, cadera, adulto mayor, general',
            'contraindications': 'cuadriplejia, riesgo alto de caida, vertigo severo',
            'min_mobility_level': 'medio',
            'default_sets': 3,
            'default_repetitions': 20,
            'default_rest_seconds': 90,
            'default_duration_seconds': 420,
        },
        {
            'name': 'Coordinacion cognitivo-motora',
            'description': 'Secuencia simple de movimientos y memoria de orden.',
            'category': 'Cognitiva',
            'compatible_diagnoses': 'cognitivo, neurologico, adulto mayor, general',
            'contraindications': 'confusion aguda',
            'min_mobility_level': 'bajo',
            'default_sets': 2,
            'default_repetitions': 12,
            'default_rest_seconds': 60,
            'default_duration_seconds': 300,
        },
        {
            'name': 'Elevacion lateral de brazo con banda',
            'description': 'Fortalecimiento progresivo de hombro.',
            'category': 'Fuerza',
            'compatible_diagnoses': 'hombro, general',
            'contraindications': 'cuadriplejia, luxacion, dolor severo',
            'min_mobility_level': 'alto',
            'default_sets': 3,
            'default_repetitions': 10,
            'default_rest_seconds': 75,
            'default_duration_seconds': 360,
        },
    ]
    for data in exercises:
        Exercise.objects.update_or_create(name=data['name'], defaults=data)


def unseed_exercises(apps, schema_editor):
    Exercise = apps.get_model('RehabWeb_API', 'Exercise')
    Exercise.objects.filter(
        name__in=[
            'Respiracion diafragmatica guiada',
            'Movilizacion pasiva de hombro',
            'Flexion controlada de rodilla',
            'Puente de gluteos asistido',
            'Marcha estacionaria con apoyo',
            'Coordinacion cognitivo-motora',
            'Elevacion lateral de brazo con banda',
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('RehabWeb_API', '0004_exercisesession_planned_duration_seconds'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilclinico',
            name='evaluacion_inicial_registrada',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='Exercise',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=140)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(default='Movilidad', max_length=80)),
                ('compatible_diagnoses', models.TextField(blank=True)),
                ('contraindications', models.TextField(blank=True)),
                ('min_mobility_level', models.CharField(choices=[('bajo', 'Bajo'), ('medio', 'Medio'), ('alto', 'Alto'), ('dependiente', 'Dependiente')], default='bajo', max_length=20)),
                ('default_sets', models.PositiveSmallIntegerField(default=3)),
                ('default_repetitions', models.PositiveIntegerField(default=10)),
                ('default_rest_seconds', models.PositiveIntegerField(default=60)),
                ('default_duration_seconds', models.PositiveIntegerField(default=600)),
                ('active', models.BooleanField(default=True)),
            ],
            options={
                'ordering': ['category', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Routine',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=160)),
                ('version', models.CharField(default='1.0', max_length=20)),
                ('status', models.CharField(choices=[('borrador', 'Borrador'), ('validada', 'Validada')], default='validada', max_length=20)),
                ('estimated_duration_seconds', models.PositiveIntegerField(default=0)),
                ('validation_warnings', models.JSONField(blank=True, default=list)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('paciente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rutinas_recibidas', to=settings.AUTH_USER_MODEL)),
                ('terapeuta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rutinas_creadas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=160)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(default='routine_assigned', max_length=60)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notificaciones', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RoutineTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=160)),
                ('clinical_tags', models.CharField(blank=True, max_length=260)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('source_routine', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='templates', to='RehabWeb_API.routine')),
                ('terapeuta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plantillas_rutina', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RoutineExercise',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveSmallIntegerField(default=1)),
                ('sets', models.PositiveSmallIntegerField(default=3)),
                ('repetitions', models.PositiveIntegerField(default=10)),
                ('rest_seconds', models.PositiveIntegerField(default=60)),
                ('duration_seconds', models.PositiveIntegerField(default=600)),
                ('notes', models.CharField(blank=True, max_length=240)),
                ('exercise', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='routine_items', to='RehabWeb_API.exercise')),
                ('routine', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='RehabWeb_API.routine')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='RoutineAssignment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('frequency', models.CharField(choices=[('diaria', 'Diaria'), ('3_semana', '3 veces por semana'), ('2_semana', '2 veces por semana'), ('semanal', 'Semanal')], default='diaria', max_length=20)),
                ('preferred_times', models.CharField(blank=True, max_length=120)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('total_weeks', models.PositiveSmallIntegerField(default=12)),
                ('special_instructions', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('asignada', 'Asignada'), ('activa', 'Activa'), ('completada', 'Completada'), ('cancelada', 'Cancelada')], default='asignada', max_length=20)),
                ('assigned_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('activated_at', models.DateTimeField(blank=True, null=True)),
                ('paciente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='asignaciones_rutina', to=settings.AUTH_USER_MODEL)),
                ('routine', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='RehabWeb_API.routine')),
                ('terapeuta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='asignaciones_creadas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-assigned_at'],
            },
        ),
        migrations.RunPython(seed_exercises, unseed_exercises),
    ]
