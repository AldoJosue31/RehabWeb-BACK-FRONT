import time

from django.conf import settings

from RehabWeb_API.roles import ROLE_TERAPEUTA, get_request_role


def jitsi_room_label(video_call):
    return f'RehabWeb-{video_call.room_id}'


def jitsi_room_name(video_call):
    room = jitsi_room_label(video_call)
    if settings.JITSI_APP_ID:
        return f'{settings.JITSI_APP_ID}/{room}'
    return room


def jitsi_script_url():
    domain = settings.JITSI_DOMAIN.rstrip('/')
    if settings.JITSI_APP_ID and domain == '8x8.vc':
        return f'https://{domain}/{settings.JITSI_APP_ID}/external_api.js'
    return f'https://{domain}/external_api.js'


def can_generate_jitsi_jwt():
    return bool(settings.JITSI_APP_ID and settings.JITSI_KID and settings.JITSI_PRIVATE_KEY)


def build_jitsi_jwt(video_call, request):
    if not can_generate_jitsi_jwt():
        return None

    import jwt

    selected_role = get_request_role(request)
    user = request.user
    is_moderator = selected_role == ROLE_TERAPEUTA and user == video_call.conversation.terapeuta
    now = int(time.time())
    full_name = user.get_full_name().strip() or user.username
    room = jitsi_room_label(video_call)
    private_key = settings.JITSI_PRIVATE_KEY.strip().strip('"').strip("'").replace('\\n', '\n')

    payload = {
        'aud': 'jitsi',
        'iss': settings.JITSI_JWT_ISSUER,
        'sub': settings.JITSI_APP_ID,
        'room': room,
        'nbf': now - 10,
        'exp': now + settings.JITSI_JWT_TTL_SECONDS,
        'context': {
            'user': {
                'id': str(user.id),
                'name': full_name,
                'email': user.email or '',
                'avatar': '',
                'moderator': is_moderator,
            },
            'features': {
                'livestreaming': False,
                'recording': False,
                'transcription': False,
                'outbound-call': False,
            },
            'room': {
                'regex': False,
            },
        },
    }

    return jwt.encode(
        payload,
        private_key,
        algorithm='RS256',
        headers={'kid': settings.JITSI_KID, 'typ': 'JWT'},
    )
