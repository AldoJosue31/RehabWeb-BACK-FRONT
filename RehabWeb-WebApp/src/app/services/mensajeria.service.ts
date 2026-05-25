import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BackendConversation, BackendMessage, BackendVideoCall } from '../models/mensajeria.models';

@Injectable({
  providedIn: 'root'
})
export class MensajeriaService {
  private http = inject(HttpClient);
  private apiUrl = '/api/mensajeria';

  private httpOptions = {
    withCredentials: true
  };

  getConversaciones(): Observable<BackendConversation[]> {
    return this.http.get<BackendConversation[]>(`${this.apiUrl}/conversaciones/`, this.httpOptions);
  }

  actualizarPresencia(): Observable<{ last_seen: string }> {
    return this.http.post<{ last_seen: string }>(
      `${this.apiUrl}/conversaciones/presencia/`,
      {},
      this.httpOptions,
    );
  }

  getMensajes(conversationId: number, before?: string): Observable<{ messages: BackendMessage[]; hasMore: boolean }> {
    const beforeParam = before ? `&before=${encodeURIComponent(before)}` : '';
    return this.http.get<BackendMessage[]>(
      `${this.apiUrl}/mensajes/?conversation=${conversationId}&limit=20${beforeParam}`,
      { ...this.httpOptions, observe: 'response' },
    ).pipe(
      map((response) => ({
        messages: response.body ?? [],
        hasMore: response.headers.get('X-Has-More') === 'true',
      })),
    );
  }

  enviarMensaje(conversationId: number, text: string | null, file: File | null): Observable<BackendMessage> {
    const formData = new FormData();
    formData.append('conversation', conversationId.toString());

    if (text) formData.append('encrypted_text', text);
    if (file) formData.append('file_attachment', file);

    return this.http.post<BackendMessage>(`${this.apiUrl}/mensajes/`, formData, this.httpOptions);
  }

  marcarComoVisto(mensajeId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/mensajes/${mensajeId}/cambiar_estado/`, { status: 'visto' }, this.httpOptions);
  }

  marcarConversacionComoVista(conversationId: number): Observable<{ actualizados: number }> {
    return this.http.patch<{ actualizados: number }>(
      `${this.apiUrl}/mensajes/marcar_vistos/`,
      { conversation_id: conversationId },
      this.httpOptions,
    );
  }

  iniciarVideollamada(conversationId: number): Observable<BackendVideoCall> {
    return this.http.post<BackendVideoCall>(
      `${this.apiUrl}/videollamadas/iniciar_llamada/`,
      { conversation_id: conversationId },
      this.httpOptions,
    );
  }

  obtenerDatosVideollamada(roomId: string, conversationId?: number): Observable<BackendVideoCall> {
    return this.http.post<BackendVideoCall>(
      `${this.apiUrl}/videollamadas/datos_sala/`,
      { room_id: roomId, conversation_id: conversationId },
      this.httpOptions,
    );
  }

  finalizarVideollamada(callId: number): Observable<{ status: string; duracion_minutos: number }> {
    return this.http.post<{ status: string; duracion_minutos: number }>(
      `${this.apiUrl}/videollamadas/${callId}/finalizar_llamada/`,
      {},
      this.httpOptions,
    );
  }
}
