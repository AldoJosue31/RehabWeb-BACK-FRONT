from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from RehabWeb_API.services import build_and_send_weekly_summaries


class Command(BaseCommand):
    help = 'Genera y envia resumenes semanales motivacionales los domingos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            help='Fecha de referencia en formato YYYY-MM-DD. Debe ser domingo para enviar.',
        )

    def handle(self, *args, **options):
        reference_date = timezone.localdate()
        if options.get('date'):
            reference_date = datetime.strptime(options['date'], '%Y-%m-%d').date()

        sent = build_and_send_weekly_summaries(reference_date)
        self.stdout.write(self.style.SUCCESS(f'Resumenes semanales procesados: {sent}'))
