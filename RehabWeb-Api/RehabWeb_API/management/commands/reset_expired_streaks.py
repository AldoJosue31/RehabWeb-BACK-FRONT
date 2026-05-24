from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from RehabWeb_API.models import MotivationProfile
from RehabWeb_API.services import reset_expired_streak


class Command(BaseCommand):
    help = 'Reinicia rachas activas cuando el paciente perdio un dia sin justificacion.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            help='Fecha de referencia en formato YYYY-MM-DD.',
        )

    def handle(self, *args, **options):
        reference_date = timezone.localdate()
        if options.get('date'):
            reference_date = datetime.strptime(options['date'], '%Y-%m-%d').date()

        reset_count = 0
        for profile in MotivationProfile.objects.filter(current_streak__gt=0):
            previous_streak = profile.current_streak
            reset_expired_streak(profile, reference_date)
            if previous_streak and profile.current_streak == 0:
                reset_count += 1

        self.stdout.write(self.style.SUCCESS(f'Rachas reiniciadas: {reset_count}'))
