from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from RehabWeb_API.models import (
    Alert,
    Exercise,
    ExerciseSession,
    MotivationProfile,
    Notification,
    PatientBadge,
    Routine,
    RoutineAssignment,
    WeeklySummary,
)
from RehabWeb_API.permissions import HasSelectedRole
from RehabWeb_API.roles import ROLE_PACIENTE, ROLE_TERAPEUTA, get_request_role
from RehabWeb_API.serializers import (
    AlertSerializer,
    ExerciseSerializer,
    ExerciseSessionSerializer,
    LeaderboardEntrySerializer,
    MotivationProfileSerializer,
    NotificationSerializer,
    PatientBadgeSerializer,
    RoutineAssignmentSerializer,
    RoutineSerializer,
    WeeklySummarySerializer,
)
from RehabWeb_API.services import (
    build_weekly_summary,
    compatible_exercises_for_patient,
    detect_inactivity_alerts,
    leaderboard_top10,
    refresh_assignment_status,
    therapist_for_patient,
)


class ExerciseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExerciseSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get_queryset(self):
        patient_id = self.request.query_params.get('paciente')
        queryset = Exercise.objects.filter(active=True)
        if not patient_id:
            return queryset

        patient = get_object_or_404(User, pk=patient_id)
        selected_role = get_request_role(self.request)
        if selected_role == ROLE_PACIENTE and patient != self.request.user:
            return Exercise.objects.none()
        if selected_role == ROLE_TERAPEUTA:
            therapist = therapist_for_patient(patient)
            if therapist and therapist != self.request.user:
                return Exercise.objects.none()

        compatible_ids = [exercise.id for exercise in compatible_exercises_for_patient(patient)]
        return queryset.filter(id__in=compatible_ids)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        patient_id = self.request.query_params.get('paciente')
        if patient_id:
            patient = get_object_or_404(User, pk=patient_id)
            context['compatible_ids'] = {str(exercise.id) for exercise in compatible_exercises_for_patient(patient)}
        return context


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get_queryset(self):
        user = self.request.user
        selected_role = get_request_role(self.request)
        queryset = Alert.objects.select_related('paciente', 'terapeuta', 'source_session')
        if selected_role == ROLE_PACIENTE:
            return queryset.filter(paciente=user)
        if selected_role == ROLE_TERAPEUTA:
            return queryset.filter(terapeuta=user)
        return queryset.filter(Q(paciente=user) | Q(terapeuta=user))

    @action(detail=True, methods=['patch'])
    def marcar_revisada(self, request, pk=None):
        alert = self.get_object()
        alert.status = Alert.STATUS_REVIEWED
        alert.reviewed_at = timezone.now()
        alert.save(update_fields=['status', 'reviewed_at'])
        return Response(self.get_serializer(alert).data)

    @action(detail=True, methods=['patch'])
    def resolver(self, request, pk=None):
        alert = self.get_object()
        alert.status = Alert.STATUS_RESOLVED
        alert.resolved_at = timezone.now()
        if not alert.reviewed_at:
            alert.reviewed_at = alert.resolved_at
        alert.save(update_fields=['status', 'reviewed_at', 'resolved_at'])
        return Response(self.get_serializer(alert).data)

    @action(detail=False, methods=['post'])
    def generar_inactividad(self, request):
        selected_role = get_request_role(request)
        if selected_role != ROLE_TERAPEUTA and not request.user.is_staff:
            return Response(
                {'error': 'Solo terapeutas pueden ejecutar la deteccion de inactividad.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        generated = detect_inactivity_alerts()
        return Response({'generadas': generated})


class ExerciseSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSessionSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get_queryset(self):
        user = self.request.user
        selected_role = get_request_role(self.request)
        queryset = ExerciseSession.objects.select_related('paciente', 'terapeuta')
        if selected_role == ROLE_PACIENTE:
            return queryset.filter(paciente=user)
        if selected_role == ROLE_TERAPEUTA:
            return queryset.filter(terapeuta=user)
        return queryset.filter(Q(paciente=user) | Q(terapeuta=user))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['role'] = get_request_role(self.request)
        return context


class RoutineViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        selected_role = get_request_role(self.request)
        queryset = Routine.objects.select_related('paciente', 'terapeuta').prefetch_related('items__exercise')
        if selected_role == ROLE_PACIENTE:
            return queryset.filter(paciente=user)
        if selected_role == ROLE_TERAPEUTA:
            return queryset.filter(terapeuta=user)
        return queryset.filter(Q(paciente=user) | Q(terapeuta=user))

    def create(self, request, *args, **kwargs):
        if get_request_role(request) != ROLE_TERAPEUTA:
            return Response({'error': 'Solo terapeutas pueden crear rutinas.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warnings = serializer.clinical_warnings()
        if warnings and not serializer.validated_data.get('override_warnings'):
            return Response(
                {
                    'requires_confirmation': True,
                    'warnings': warnings,
                    'detail': 'Confirma la creacion si deseas continuar con estos riesgos.',
                },
                status=status.HTTP_409_CONFLICT,
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class RoutineAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = RoutineAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        selected_role = get_request_role(self.request)
        queryset = RoutineAssignment.objects.select_related('routine', 'paciente', 'terapeuta').prefetch_related('routine__items__exercise')
        if selected_role == ROLE_PACIENTE:
            assignments = queryset.filter(paciente=user)
        elif selected_role == ROLE_TERAPEUTA:
            assignments = queryset.filter(terapeuta=user)
        else:
            assignments = queryset.filter(Q(paciente=user) | Q(terapeuta=user))

        for assignment in assignments:
            refresh_assignment_status(assignment)
        return assignments

    def create(self, request, *args, **kwargs):
        if get_request_role(request) != ROLE_TERAPEUTA:
            return Response({'error': 'Solo terapeutas pueden asignar rutinas.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['patch'])
    def marcar_leida(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)


class MotivationProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get_object(self, request):
        profile, _ = MotivationProfile.objects.get_or_create(usuario=request.user)
        return profile

    def get(self, request):
        serializer = MotivationProfileSerializer(self.get_object(request))
        return Response(serializer.data)

    def patch(self, request):
        serializer = MotivationProfileSerializer(
            self.get_object(request),
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PatientBadgeListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get(self, request):
        selected_role = get_request_role(request)
        user_id = request.query_params.get('paciente')
        user = request.user
        if selected_role == ROLE_TERAPEUTA and user_id:
            user = get_object_or_404(ExerciseSession.objects.filter(terapeuta=request.user), paciente_id=user_id).paciente
        badges = PatientBadge.objects.filter(usuario=user)
        return Response(PatientBadgeSerializer(badges, many=True).data)


class WeeklySummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get(self, request):
        selected_role = get_request_role(request)
        patient = request.user
        patient_id = request.query_params.get('paciente')
        if selected_role == ROLE_TERAPEUTA and patient_id:
            session = get_object_or_404(ExerciseSession.objects.filter(terapeuta=request.user), paciente_id=patient_id)
            patient = session.paciente

        summary = build_weekly_summary(patient)
        return Response(WeeklySummarySerializer(summary).data)


class LeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasSelectedRole]

    def get(self, request):
        entries = leaderboard_top10()
        return Response(LeaderboardEntrySerializer(entries, many=True).data)
