# Generated for motivation velocity bonus support.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('RehabWeb_API', '0003_alerts_sessions_motivation'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercisesession',
            name='planned_duration_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
