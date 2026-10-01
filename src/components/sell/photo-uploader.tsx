"use client";
import { useId, useRef, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Camera, GripVertical, Loader2, X } from "lucide-react";

export type UploadedPhoto = { id: string; url: string };
type Pending = { tempId: string; name: string };

function SortablePhoto({
  photo, index, total, onRemove, onMove,
}: { photo: UploadedPhoto; index: number; total: number; onRemove: () => void; onMove: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-square overflow-hidden rounded-none border border-line bg-brand-50 ${isDragging ? "z-10 shadow-[var(--shadow-tag)]" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={`Photo ${index + 1}${index === 0 ? " (cover)" : ""}`} className="h-full w-full object-cover" />
      {index === 0 && <span className="absolute top-1 left-1 rounded-none bg-accent-400 px-1.5 font-mono text-[11px] font-bold">COVER</span>}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder photo ${index + 1}. Press space to pick up, arrow keys to move, space to drop.`}
        className="absolute bottom-1 left-1 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-none border border-line bg-surface active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="absolute right-1 bottom-1 flex gap-1">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-line bg-surface disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move photo ${index + 1} later`} className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-line bg-surface disabled:opacity-40">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove photo ${index + 1}`} className="absolute top-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-none border border-line bg-surface hover:bg-danger hover:text-white">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function PhotoUploader({ initial, max = 20, error }: { initial: UploadedPhoto[]; max?: number; error?: string }) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const room = max - photos.length - pending.length;
    const chosen = [...files].slice(0, Math.max(0, room));
    const errs: string[] = [];
    if (files.length > room) errs.push(`You can add up to ${max} photos.`);
    const queue = chosen.map((f) => ({ tempId: crypto.randomUUID(), name: f.name, file: f }));
    setPending((p) => [...p, ...queue.map(({ tempId, name }) => ({ tempId, name }))]);
    // Upload 3 at a time.
    const results: (UploadedPhoto | null)[] = new Array(queue.length).fill(null);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (next < queue.length) {
          const i = next++;
          const item = queue[i];
          const body = new FormData();
          body.append("file", item.file);
          try {
            const res = await fetch("/api/uploads/listing-photo", { method: "POST", body });
            const json = await res.json();
            if (!res.ok) errs.push(`${item.name}: ${json.error ?? "upload failed"}`);
            else results[i] = { id: json.id, url: json.url };
          } catch {
            errs.push(`${item.name}: upload failed`);
          }
          setPending((p) => p.filter((x) => x.tempId !== item.tempId));
        }
      }),
    );
    const ok = results.filter((r): r is UploadedPhoto => !!r);
    setPhotos((p) => [...p, ...ok].slice(0, max));
    setMessages(errs);
    setAnnounce(`${ok.length} photo${ok.length === 1 ? "" : "s"} added.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPhotos((p) => {
      const from = p.findIndex((x) => x.id === active.id);
      const to = p.findIndex((x) => x.id === over.id);
      setAnnounce(`Photo moved to position ${to + 1}.`);
      return arrayMove(p, from, to);
    });
  }

  function move(index: number, dir: -1 | 1) {
    setPhotos((p) => arrayMove(p, index, index + dir));
    setAnnounce(`Photo moved to position ${index + dir + 1}.`);
  }

  return (
    <fieldset aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}>
      <legend className="text-lg font-bold">Photos</legend>
      <p id={`${id}-hint`} className="hint">
        Add up to {max}. The first photo is the cover – drag, or use the arrow buttons, to reorder. Show any flaws clearly.
      </p>
      {photos.map((p) => (
        <input key={p.id} type="hidden" name="photoIds" value={p.id} />
      ))}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" role="list">
            {photos.map((p, i) => (
              <SortablePhoto key={p.id} photo={p} index={i} total={photos.length} onRemove={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} onMove={(d) => move(i, d)} />
            ))}
            {pending.map((p) => (
              <li key={p.tempId} className="flex aspect-square items-center justify-center rounded-none border border-dashed border-line-strong/50 bg-surface">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                <span className="sr-only">Uploading {p.name}</span>
              </li>
            ))}
            {photos.length + pending.length < max && (
              <li>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-none border border-dashed border-line-strong bg-surface text-sm font-semibold hover:bg-brand-50 focus-within:outline-3 focus-within:outline-ink">
                  <Camera className="h-6 w-6" aria-hidden="true" />
                  Add photos
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
                </label>
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="mt-2 font-mono text-xs text-muted">{photos.length}/{max}</p>
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium text-danger">{error}</p>}
      {messages.length > 0 && (
        <ul role="alert" className="mt-2 space-y-1 text-sm text-danger">
          {messages.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">{announce}</p>
    </fieldset>
  );
}
