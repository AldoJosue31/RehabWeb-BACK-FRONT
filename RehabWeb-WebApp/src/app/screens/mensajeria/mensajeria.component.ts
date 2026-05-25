import { Component, signal, ViewChild, ElementRef, ChangeDetectionStrategy, effect, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MensajeriaService } from '../../services/mensajeria.service';
import { AuthRole, AuthService } from '../../services/auth.service';
import { BackendContactInfo, BackendConversation, BackendMessage, BackendVideoCall } from '../../models/mensajeria.models';
import { interval, Subscription, startWith } from 'rxjs';

interface UIMessage {
  id: string;
  text: string;
  isMine: boolean;
  timestamp: Date;
  status: string;
  fileName?: string;
  fileUrl?: string;
  isImage?: boolean;
  isJoinableCall?: boolean;
}

interface UIPatient {
  id: string;
  name: string;
  lastMessageTime: string;
  lastMessagePreview: string;
  initials: string;
  isOnline: boolean;
  lastSeenLabel: string;
  unreadCount: number;
  roleLabel: string;
}

interface JitsiMeetExternalApi {
  dispose(): void;
  addEventListener?(event: string, listener: (data: unknown) => void): void;
  executeCommand?(command: string, ...args: unknown[]): void;
}

interface JitsiMeetExternalApiOptions {
  roomName: string;
  parentNode: HTMLElement;
  width: string;
  height: string;
  lang: string;
  jwt?: string;
  userInfo: {
    displayName: string;
  };
  configOverwrite: Record<string, unknown>;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: JitsiMeetExternalApiOptions,
    ) => JitsiMeetExternalApi;
  }
}

@Component({
  selector: 'app-mensajeria',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajeria.component.html',
  styleUrl: './mensajeria.component.scss'
})
export class MensajeriaComponent implements OnInit, OnDestroy {
  private mensajeriaService = inject(MensajeriaService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private pollingSubs: Subscription[] = [];
  private jitsiApi: JitsiMeetExternalApi | null = null;
  private jitsiApiScriptPromise: Promise<void> | null = null;
  private jitsiApiScriptUrl: string | null = null;

  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('jitsiContainer') jitsiContainer?: ElementRef<HTMLDivElement>;

  currentUserId: number = 0;
  currentUserRole: AuthRole = 'terapeuta';
  currentUsername = '';

  messageCtrl = new FormControl('');
  selectedFile = signal<File | null>(null);
  errorMsg = signal<string>('');
  isSending = signal<boolean>(false);
  isLoadingConversations = signal<boolean>(true);
  isLoadingMessages = signal<boolean>(false);
  hasMoreMessages = signal<boolean>(false);
  isLoadingOlder = signal<boolean>(false);
  imagePreviewUrl = signal<string | null>(null);

  jitsiRoomName = signal<string | null>(null);
  currentJitsiCall = signal<BackendVideoCall | null>(null);
  activeVideoCallId = signal<number | null>(null);

  conversations = signal<BackendConversation[]>([]);
  messages = signal<BackendMessage[]>([]);
  selectedConvId = signal<number | null>(null);

  patients = computed<UIPatient[]>(() => {
    return this.conversations().map(conv => {
      const amIPaciente = conv.paciente === this.currentUserId;
      const contact = amIPaciente ? conv.terapeuta_info : conv.paciente_info;
      const roleLabel = amIPaciente ? 'Terapeuta' : 'Paciente';
      const contactName = this.contactDisplayName(contact, roleLabel);
      return {
        id: conv.id.toString(),
        name: contactName,
        initials: this.contactInitials(contactName, roleLabel),
        lastMessageTime: conv.ultimo_mensaje ? this.formatTime(new Date(conv.ultimo_mensaje.timestamp)) : '',
        lastMessagePreview: conv.ultimo_mensaje?.encrypted_text || (conv.ultimo_mensaje?.file_attachment ? '📎 Archivo' : 'Sin mensajes'),
        isOnline: contact?.is_online ?? false,
        lastSeenLabel: this.formatLastSeen(contact?.last_seen ?? null),
        unreadCount: conv.unread_count ?? 0,
        roleLabel
      };
    });
  });

  totalUnreadMessages = computed(() => {
    return this.conversations().reduce((total, conv) => total + (conv.unread_count ?? 0), 0);
  });

  messagingSubtitle = computed(() => {
    const chatCount = this.conversations().length;
    const unreadCount = this.totalUnreadMessages();
    const chatLabel = chatCount === 1 ? '1 chat' : `${chatCount} chats`;
    const unreadLabel = unreadCount === 0
      ? 'Sin mensajes nuevos'
      : unreadCount === 1
        ? '1 mensaje nuevo'
        : `${unreadCount} mensajes nuevos`;

    return `${chatLabel} | ${unreadLabel}`;
  });

  selectedPatientId = computed(() => this.selectedConvId()?.toString() || '');
  activePatient = computed(() => this.patients().find(p => p.id === this.selectedPatientId()) || {
    id: '',
    name: 'Seleccione un chat',
    lastMessageTime: '',
    lastMessagePreview: '',
    initials: '?',
    isOnline: false,
    lastSeenLabel: 'Sin conexion reciente',
    unreadCount: 0,
    roleLabel: 'Contacto'
  });

  activeMessages = computed<UIMessage[]>(() => {
    const convId = this.selectedConvId();
    if (!convId) return [];

    const rawMsgs = this.messages().filter(m => m.conversation === convId);

    // Identificamos el estado mas reciente de las videollamadas en la conversación
    const mensajesVideo = rawMsgs.filter(m =>
      m.encrypted_text?.includes('Videollamada iniciada') ||
      m.encrypted_text === 'Videollamada finalizada'
    );
    const ultimoMsjVideo = mensajesVideo.length > 0 ? mensajesVideo[mensajesVideo.length - 1] : null;

    return rawMsgs.map(m => {
      const isJoinable = ultimoMsjVideo &&
                         ultimoMsjVideo.id === m.id &&
                         m.encrypted_text?.includes('Videollamada iniciada');
      const isMine = m.sender === this.currentUserId;

      return {
        id: m.id.toString(),
        text: m.encrypted_text || '',
        isMine,
        timestamp: new Date(m.timestamp),
        status: m.status,
        fileName: m.file_attachment ? m.file_attachment.split('/').pop() : undefined,
        fileUrl: m.file_attachment ? this.normalizeFileUrl(m.file_attachment) : undefined,
        isImage: !!m.file_attachment && this.isImageUrl(m.file_attachment),
        isJoinableCall: !!isJoinable
      };
    });
  });

  constructor() {
    effect(() => {
      this.activeMessages();
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  ngOnInit() {
    const token = this.authService.getToken();
    const savedId = this.authService.getCurrentUserId();
    const savedRole = this.authService.getRole();
    if (!token || !savedId || !savedRole) {
      this.showError('Inicia sesion para ver tus conversaciones.');
      void this.router.navigateByUrl('/login');
      return;
    }

    // Buscamos si el ID viene por la URL (como en tus pruebas: ?user=3)
    const userParam: string | null = null;

    // Buscamos si el ID ya está guardado de un login previo
    const legacySavedId = savedId.toString();

    if (userParam) {
      this.currentUserId = parseInt(userParam);
      // Guardamos en memoria para que no se pierda al recargar la página
      this.setStoredUserId(userParam);
    } else if (legacySavedId) {
      this.currentUserId = parseInt(legacySavedId);
    } else {
      this.showError('No se encontro el usuario autenticado.');
      return;
    }

    this.currentUserRole = savedRole;
    this.currentUsername = this.authService.getUsername() ?? '';

    // Solo hacemos peticiones al backend si tenemos un ID válido
    if (this.currentUserId > 0) {
      this.cargarConversaciones();
      this.iniciarPolling();
    }
  }

  ngOnDestroy() {
    this.stopPolling();
    this.disposeJitsiApi();
  }

  private iniciarPolling() {
    this.stopPolling();

    const mensajesSub = interval(1000)
      .pipe(startWith(0))
      .subscribe(() => {
        const convId = this.selectedConvId();
        if (convId) this.cargarMensajes(convId, undefined, false);
      });

    const conversacionesSub = interval(5000)
      .pipe(startWith(0))
      .subscribe(() => this.cargarConversaciones(false));

    const presenciaSub = interval(30000)
      .pipe(startWith(0))
      .subscribe(() => this.actualizarPresencia());

    this.pollingSubs = [mensajesSub, conversacionesSub, presenciaSub];
  }

  private actualizarPresencia() {
    this.mensajeriaService.actualizarPresencia().subscribe({
      error: err => this.handleAuthError(err)
    });
  }

  cargarConversaciones(showLoading = true) {
    if (showLoading && this.conversations().length === 0) this.isLoadingConversations.set(true);

    this.mensajeriaService.getConversaciones().subscribe({
      next: (data) => {
        this.conversations.set(data);
        this.isLoadingConversations.set(false);
        if (data.length > 0 && !this.selectedConvId()) {
          this.selectPatient(data[0].id.toString());
        }
      },
      error: (err) => {
        this.isLoadingConversations.set(false);
        this.handleAuthError(err);
      }
    });
  }

  selectPatient(id: string) {
    const convId = parseInt(id);
    this.selectedConvId.set(convId);
    this.cargarMensajes(convId);
    this.closeVideoRoom();
  }

   cargarMensajes(convId: number, before?: string, showLoading = true) {
    if (before) this.isLoadingOlder.set(true);
    if (!before && showLoading && !this.messages().some(message => message.conversation === convId)) {
      this.isLoadingMessages.set(true);
    }

    this.mensajeriaService.getMensajes(convId, before).subscribe({
      next: (page) => {
        const filtered = page.messages.filter(m => m.conversation === convId);
        this.hasMoreMessages.set(page.hasMore);

        const nextMessages = before
          ? [...filtered, ...this.messages()]
          : this.mergeLatestMessages(filtered);

        if (JSON.stringify(nextMessages) !== JSON.stringify(this.messages())) {
          this.messages.set(nextMessages);
          this.marcarComoVistos(filtered);

          const mensajesVideo = nextMessages.filter(m =>
            m.encrypted_text?.includes('Videollamada iniciada') ||
            m.encrypted_text === 'Videollamada finalizada'
          );

          const ultimoMsjVideo = mensajesVideo.length > 0 ? mensajesVideo[mensajesVideo.length - 1] : null;

          if (ultimoMsjVideo && ultimoMsjVideo.encrypted_text === 'Videollamada finalizada' && this.jitsiRoomName() !== null) {
              console.log("Cerrando sala automáticamente porque la otra parte colgó.");
              this.closeVideoRoom();
              this.activeVideoCallId.set(null);
          }
        }
        this.isLoadingMessages.set(false);
        this.isLoadingOlder.set(false);
      },
      error: (err) => {
        this.isLoadingMessages.set(false);
        this.isLoadingOlder.set(false);
        this.handleAuthError(err);
      }
    });
  }

  loadOlderMessages() {
    const convId = this.selectedConvId();
    const firstMessage = this.messages()[0];
    if (!convId || !firstMessage || !this.hasMoreMessages() || this.isLoadingOlder()) return;
    this.cargarMensajes(convId, firstMessage.timestamp);
  }

  onChatScroll() {
    const el = this.chatContainer?.nativeElement;
    if (el && el.scrollTop < 80) this.loadOlderMessages();
  }

  private mergeLatestMessages(latest: BackendMessage[]): BackendMessage[] {
    const byId = new Map<number, BackendMessage>();
    [...this.messages(), ...latest].forEach((message) => byId.set(message.id, message));
    return Array.from(byId.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private marcarComoVistos(mensajes: BackendMessage[]) {
    const pendientes = mensajes.filter(m => m.sender !== this.currentUserId && m.status !== 'visto');
    const conversationId = mensajes[0]?.conversation;
    if (!conversationId || pendientes.length === 0) return;

    this.mensajeriaService.marcarConversacionComoVista(conversationId).subscribe({
      next: () => {
        const ids = new Set(pendientes.map(m => m.id));
        this.messages.update(state => state.map(m => ids.has(m.id) ? { ...m, status: 'visto' } : m));
      },
      error: err => this.handleAuthError(err)
    });
  }

  sendMessage() {
    const text = this.messageCtrl.value?.trim() || null;
    const file = this.selectedFile();
    const convId = this.selectedConvId();
    if ((!text && !file) || !convId) return;

    this.isSending.set(true);
    const tempId = -Date.now();
    const optimisticMsg: BackendMessage = {
      id: tempId,
      conversation: convId,
      sender: this.currentUserId,
      encrypted_text: text,
      file_attachment: null,
      timestamp: new Date().toISOString(),
      status: 'enviado',
    };

    this.messages.update(msgs => [...msgs, optimisticMsg]);
    this.messageCtrl.setValue('');
    this.selectedFile.set(null);
    this.scrollToBottom();

    this.mensajeriaService.enviarMensaje(convId, text, file).subscribe({
      next: (newMsg) => {
        this.messages.update(msgs => {
          if (msgs.some(msg => msg.id === newMsg.id)) return msgs.filter(msg => msg.id !== tempId);
          if (msgs.some(msg => msg.id === tempId)) {
            return msgs.map(msg => msg.id === tempId ? newMsg : msg);
          }
          return [...msgs, newMsg];
        });
        this.isSending.set(false);
        this.scrollToBottom();
        this.cargarConversaciones(); // Para actualizar el preview de la izquierda
      },
      error: (err) => {
        this.messages.update(msgs => msgs.filter(msg => msg.id !== tempId));
        this.isSending.set(false);
        if (!this.handleAuthError(err)) this.showError('Error al enviar el mensaje.');
      }
    });
  }

  private getAuthToken(): string | null {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('token')
      : null;
  }

  private getStoredUserId(): string | null {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('user_id')
      : null;
  }

  private setStoredUserId(userId: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('user_id', userId);
    }
  }

  private stopPolling() {
    this.pollingSubs.forEach(sub => sub.unsubscribe());
    this.pollingSubs = [];
  }

  private handleAuthError(err: { status?: number }): boolean {
    if (err.status === 401 || err.status === 403) {
      this.stopPolling();
      this.authService.logout();
      this.showError('Sesion expirada o no iniciada.');
      void this.router.navigateByUrl('/login');
      return true;
    }

    return false;
  }

  private showError(msg: string) {
    this.errorMsg.set(msg);
    setTimeout(() => this.errorMsg.set(''), 5000);
  }

  private scrollToBottom(): void {
    if (this.chatContainer) this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }

  formatLastSeen(value: string | null): string {
    if (!value) return 'Sin conexion reciente';

    const lastSeen = new Date(value);
    const diffMs = Date.now() - lastSeen.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return 'Conexion reciente';
    if (diffMs < 60_000) return 'En linea';

    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 365 * 24 * 60 * 60 * 1000],
      ['month', 30 * 24 * 60 * 60 * 1000],
      ['week', 7 * 24 * 60 * 60 * 1000],
      ['day', 24 * 60 * 60 * 1000],
      ['hour', 60 * 60 * 1000],
      ['minute', 60 * 1000],
    ];
    const formatter = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
    const [unit, unitMs] = units.find(([, ms]) => diffMs >= ms) ?? ['minute', 60 * 1000];

    return `Ultima conexion ${formatter.format(-Math.floor(diffMs / unitMs), unit)}`;
  }

  roleName(role: AuthRole): string {
    return role === 'terapeuta' ? 'Terapeuta' : 'Paciente';
  }

  private contactDisplayName(contact: BackendContactInfo | undefined, fallbackRole: string): string {
    if (!contact) return fallbackRole;

    const name = contact.nombre_completo?.trim() || contact.username?.trim();
    return name || fallbackRole;
  }

  private contactInitials(name: string, fallbackRole: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return (parts[0]?.slice(0, 2) || fallbackRole.slice(0, 1)).toUpperCase();
  }

  logout(): void {
    this.stopPolling();
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  onFileSelected(event: any) {
    const file = event.target.files[0] as File;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showError('Solo puedes adjuntar imagenes.');
      return;
    }
    if (file.size <= 5 * 1024 * 1024) this.selectedFile.set(file);
    else if (file) this.showError('El archivo excede los 5MB.');
  }

  removeFile() { this.selectedFile.set(null); }

  iniciarVideollamada() {
    const convId = this.selectedConvId();
    if (!convId) {
      this.showError('Selecciona un chat primero.');
      return;
    }

    this.mensajeriaService.iniciarVideollamada(convId).subscribe({
      next: (res) => {
        this.activeVideoCallId.set(res.id);
        this.openVideoRoom(res);
      },
      error: (err) => {
        console.error('Error al generar sala de video:', err);
        if (!this.handleAuthError(err)) {
          this.showError('No se pudo iniciar la videollamada. Intenta nuevamente.');
        }
      }
    });
  }

  unirseVideollamada(messageText: string) {
    const roomId = messageText.split('Sala:')[1]?.trim();
    if (!roomId) {
      this.showError('No se encontro la sala de la videollamada.');
      return;
    }
    this.mensajeriaService.obtenerDatosVideollamada(roomId, this.selectedConvId() ?? undefined).subscribe({
      next: (res) => {
        this.activeVideoCallId.set(res.id);
        this.openVideoRoom(res);
      },
      error: (err) => {
        if (!this.handleAuthError(err)) {
          this.showError('No se pudo obtener acceso a la videollamada activa.');
        }
      }
    });
  }

  terminarVideollamada() {
    // Cerramos el iframe visualmente de inmediato
    this.closeVideoRoom();

    const convId = this.selectedConvId();
    const callId = this.activeVideoCallId();

    const currentMsgs = this.activeMessages();

    const videoMsgs = currentMsgs.filter(m =>
      m.text.includes('Videollamada iniciada') ||
      m.text === 'Videollamada finalizada'
    );
    const lastVideoMsg = videoMsgs.length > 0 ? videoMsgs[videoMsgs.length - 1] : null;

    const isAlreadyEnded = lastVideoMsg && lastVideoMsg.text === 'Videollamada finalizada';

    // Avisamos en el chat que la llamada terminó
    if (convId && !isAlreadyEnded) {
      this.mensajeriaService.enviarMensaje(convId, 'Videollamada finalizada', null).subscribe({
        next: (newMsg) => {
          this.messages.update(msgs => [...msgs, newMsg]);
          this.scrollToBottom();
          this.cargarConversaciones();
        },
        error: (err) => {
          if (!this.handleAuthError(err)) console.error('No se pudo enviar el aviso de fin de llamada', err);
        }
      });
    }

    // Cierre en la base de datos
    if (callId) {
      this.mensajeriaService.finalizarVideollamada(callId).subscribe({
        next: () => {
          this.activeVideoCallId.set(null);
          console.log("Sala cerrada en el backend correctamente.");
        },
        error: (err) => {
          if (!this.handleAuthError(err)) console.error('Error al cerrar la sala en Django', err);
        }
      });
    }
  }

  openImage(url: string) {
    this.imagePreviewUrl.set(url);
  }

  closeImage() {
    this.imagePreviewUrl.set(null);
  }

  private normalizeFileUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private isImageUrl(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(url.split('?')[0]);
  }

  private openVideoRoom(call: BackendVideoCall) {
    if ((call.jitsi_domain === 'meet.jit.si' || call.jitsi_domain === '8x8.vc') && !call.jitsi_jwt) {
      this.showError('Para iniciar automaticamente como anfitrion, configura Jitsi/JaaS con JWT en el backend.');
      return;
    }

    const roomName = call.room_name || `RehabWeb-${call.room_id}`;
    this.closeVideoRoom();
    this.currentJitsiCall.set(call);
    this.jitsiRoomName.set(roomName);
    setTimeout(() => void this.mountJitsiRoom(call));
  }

  private closeVideoRoom(): void {
    this.jitsiRoomName.set(null);
    this.currentJitsiCall.set(null);
    this.disposeJitsiApi();
  }

  private disposeJitsiApi(): void {
    this.jitsiApi?.dispose();
    this.jitsiApi = null;
  }

  private async mountJitsiRoom(call: BackendVideoCall): Promise<void> {
    if (this.jitsiRoomName() !== call.room_name) return;

    try {
      await this.loadJitsiApiScript(call.jitsi_script_url);
    } catch {
      this.closeVideoRoom();
      this.showError('No se pudo cargar Jitsi Meet. Revisa tu conexion e intenta nuevamente.');
      return;
    }

    if (this.jitsiRoomName() !== call.room_name) return;

    const parentNode = this.jitsiContainer?.nativeElement;
    const JitsiMeetExternalAPI = typeof window !== 'undefined' ? window.JitsiMeetExternalAPI : undefined;
    if (!parentNode || !JitsiMeetExternalAPI) {
      this.closeVideoRoom();
      this.showError('No se pudo abrir la videollamada.');
      return;
    }

    const displayName = this.currentAccountDisplayName();
    parentNode.innerHTML = '';
    this.jitsiApi = new JitsiMeetExternalAPI(call.jitsi_domain, {
      roomName: call.room_name,
      parentNode,
      width: '100%',
      height: '100%',
      lang: 'es',
      ...(call.jitsi_jwt ? { jwt: call.jitsi_jwt } : {}),
      userInfo: { displayName },
      configOverwrite: {
        disableDeepLinking: true,
        hideConferenceSubject: true,
        prejoinConfig: { enabled: false },
        prejoinPageEnabled: false,
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        toolbarButtons: ['camera', 'microphone', 'desktop', 'fullscreen', 'settings'],
      },
    });

    this.jitsiApi.addEventListener?.('videoConferenceJoined', () => {
      this.jitsiApi?.executeCommand?.('displayName', displayName);
    });
  }

  private loadJitsiApiScript(scriptUrl: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject();
    }

    if (window.JitsiMeetExternalAPI && this.jitsiApiScriptUrl === scriptUrl) {
      return Promise.resolve();
    }

    if (this.jitsiApiScriptPromise && this.jitsiApiScriptUrl === scriptUrl) {
      return this.jitsiApiScriptPromise;
    }

    this.jitsiApiScriptUrl = scriptUrl;
    this.jitsiApiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.jitsiApiScriptPromise = null;
        this.jitsiApiScriptUrl = null;
        reject();
      };
      document.body.appendChild(script);
    });

    return this.jitsiApiScriptPromise;
  }

  private currentAccountDisplayName(): string {
    const convId = this.selectedConvId();
    const conversation = this.conversations().find(conv => conv.id === convId);
    const currentAccount = conversation
      ? conversation.paciente === this.currentUserId
        ? conversation.paciente_info
        : conversation.terapeuta_info
      : undefined;

    return currentAccount?.nombre_completo?.trim() || this.currentUsername.trim() || 'Usuario RehabWeb';
  }
}
