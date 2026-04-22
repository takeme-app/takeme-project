import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────
export interface FileUploadProps {
  /** Storage bucket (default: chat-attachments) */
  bucket?: string;
  /**
   * Prefixo obrigatório do caminho no bucket (ex.: conversationId).
   * Garante compatibilidade com as policies RLS do storage, que exigem
   * `${conversationId}/...` como primeira pasta.
   */
  pathPrefix: string;
  /** Callback ao completar upload (signed URL de 1 ano já pronta para exibir). */
  onUploaded: (signedUrl: string, type: 'pdf' | 'image') => void;
  /** Cancela o upload / fecha o componente */
  onCancel?: () => void;
  /** Aceita apenas certos tipos (default: pdf + imagens) */
  accept?: string;
  style?: React.CSSProperties;
}

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365;

// ── Styles ───────────────────────────────────────────────────────────
const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const containerStyle: React.CSSProperties = {
  ...font,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const dropzoneStyle: React.CSSProperties = {
  border: '2px dashed #e2e2e2',
  borderRadius: 8,
  padding: '16px 12px',
  textAlign: 'center' as const,
  cursor: 'pointer',
  fontSize: 13,
  color: '#767676',
  transition: 'border-color 0.2s, background 0.2s',
};

const dropzoneHoverStyle: React.CSSProperties = {
  ...dropzoneStyle,
  borderColor: '#F59E0B',
  background: '#fffbeb',
};

const previewStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: '#f9f9f9',
  borderRadius: 8,
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  ...font,
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

// ── Helpers ──────────────────────────────────────────────────────────
function getFileType(file: File): 'pdf' | 'image' | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────
export default function FileUpload(props: FileUploadProps) {
  const { bucket = 'chat-attachments', pathPrefix, onUploaded, onCancel, accept = '.pdf,.png,.jpg,.jpeg,.webp', style } = props;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const type = getFileType(f);
    if (!type) {
      setError('Formato não suportado. Use PDF, PNG, JPG ou WEBP.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10 MB.');
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    const type = getFileType(file);
    if (!type) return;
    const safePrefix = (pathPrefix || '').trim();
    if (!safePrefix) {
      setError('Contexto inválido para upload.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const rawExt = file.name.split('.').pop() || 'bin';
      const ext = rawExt.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
      const id = (globalThis.crypto?.randomUUID?.() as string | undefined)
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${safePrefix}/${id}.${ext}`;

      const { error: uploadError } = await (supabase as any).storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await (supabase as any).storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('Não foi possível gerar URL assinada');

      onUploaded(signed.signedUrl, type);
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }, [file, bucket, pathPrefix, onUploaded]);

  const handleDrop = useCallback((e: any) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer?.files);
  }, [handleFileSelect]);

  return React.createElement('div', { style: { ...containerStyle, ...style } },
    // File input (hidden)
    React.createElement('input', {
      ref: inputRef,
      type: 'file',
      accept,
      style: { display: 'none' },
      onChange: (e: any) => handleFileSelect(e.target.files),
    }),

    // Dropzone ou preview
    file
      ? React.createElement('div', { style: previewStyle },
          React.createElement('span', { style: { fontSize: 18 } }, getFileType(file) === 'pdf' ? '\u{1F4C4}' : '\u{1F5BC}'),
          React.createElement('div', { style: { flex: 1, overflow: 'hidden' } },
            React.createElement('div', { style: { fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' } }, file.name),
            React.createElement('div', { style: { fontSize: 12, color: '#767676' } }, formatSize(file.size)),
          ),
          React.createElement('button', {
            onClick: () => { setFile(null); setError(null); },
            style: { ...btnStyle, background: '#f1f1f1', color: '#767676' },
          }, 'Remover'),
        )
      : React.createElement('div', {
          style: dragOver ? dropzoneHoverStyle : dropzoneStyle,
          onClick: () => inputRef.current?.click(),
          onDragOver: (e: any) => { e.preventDefault(); setDragOver(true); },
          onDragLeave: () => setDragOver(false),
          onDrop: handleDrop,
        },
          'Arraste um arquivo ou clique para selecionar',
          React.createElement('div', { style: { fontSize: 11, color: '#999', marginTop: 4 } }, 'PDF, PNG, JPG (max 10 MB)'),
        ),

    // Error
    error
      ? React.createElement('div', { style: { color: '#b53838', fontSize: 12 } }, error)
      : null,

    // Actions
    React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
      onCancel
        ? React.createElement('button', {
            onClick: onCancel,
            style: { ...btnStyle, background: '#f1f1f1', color: '#0d0d0d' },
          }, 'Cancelar')
        : null,
      file
        ? React.createElement('button', {
            onClick: handleUpload,
            disabled: uploading,
            style: { ...btnStyle, background: '#F59E0B', color: '#fff', opacity: uploading ? 0.6 : 1 },
          }, uploading ? 'Enviando...' : 'Enviar')
        : null,
    ),
  );
}
