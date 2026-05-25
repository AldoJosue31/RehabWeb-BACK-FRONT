from datetime import date, timedelta
from types import SimpleNamespace

from django.test import SimpleTestCase

from RehabWeb_API.services import calculate_speed_bonus, reset_expired_streak


class MotivationRulesTests(SimpleTestCase):
    def test_speed_bonus_uses_planned_duration_when_available(self):
        self.assertEqual(calculate_speed_bonus(20, 500, 1200), 2)
        self.assertEqual(calculate_speed_bonus(20, 1000, 1200), 0)

    def test_speed_bonus_falls_back_to_execution_pace(self):
        self.assertEqual(calculate_speed_bonus(30, 60), 8)
        self.assertEqual(calculate_speed_bonus(10, 120), 0)

    def test_expired_streak_resets_after_missing_a_day(self):
        class Profile(SimpleNamespace):
            def save(self, update_fields=None):
                self.saved_fields = update_fields

        profile = Profile(current_streak=4, last_session_date=date(2026, 5, 20))

        reset_expired_streak(profile, date(2026, 5, 22))

        self.assertEqual(profile.current_streak, 0)
        self.assertEqual(profile.saved_fields, ['current_streak', 'updated_at'])

    def test_active_streak_is_preserved_for_yesterday(self):
        class Profile(SimpleNamespace):
            def save(self, update_fields=None):
                self.saved_fields = update_fields

        today = date(2026, 5, 24)
        profile = Profile(current_streak=2, last_session_date=today - timedelta(days=1))

        reset_expired_streak(profile, today)

        self.assertEqual(profile.current_streak, 2)
        self.assertFalse(hasattr(profile, 'saved_fields'))
