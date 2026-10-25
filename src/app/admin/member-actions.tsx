"use client";

import { Ban, DoorOpen, Loader2, Snowflake, Sun, Undo2 } from "lucide-react";
import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/db/schema";
import type { PanelRole } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";
import {
  cancelMemberSubscription,
  freezeMemberSubscription,
  manualBypass,
  resumeMemberSubscription,
  unfreezeMemberSubscription,
  type AdminActionResult,
  type CancelMode,
} from "./actions";

const MANUAL_NOTE_MAX_LENGTH = 200;
const FREEZE_OPTIONS: { value: number | null; label: string }[] = [
  { value: 7, label: "1 hafta" },
  { value: 14, label: "2 hafta" },
  { value: 30, label: "30 gün" },
  { value: null, label: "Süresiz (elle kaldırılana kadar)" },
];
const CANCEL_MODES: { value: CancelMode; title: string; description: string }[] = [
  {
    value: "period_end",
    title: "Dönem sonunda iptal et",
    description: "Üye ödediği dönemin sonuna kadar salona girebilir, sonra yenilenmez.",
  },
  { value: "now", title: "Hemen iptal et", description: "Erişim hemen kapanır. Kalan süre için otomatik iade yapılmaz." },
];

export interface MemberActionsProps {
  viewerRole: PanelRole;
  userId: string;
  memberName: string;
  subscriptionId: string | null;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
}

/** One shared pending/result state per row, so messages appear under the row. */
function useRowAction() {
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<AdminActionResult>, onSuccess?: () => void) =>
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) onSuccess?.();
    });
  return { result, setResult, pending, run };
}

export function MemberActions(props: MemberActionsProps) {
  const { viewerRole, userId, memberName, subscriptionId, status, cancelAtPeriodEnd } = props;
  const row = useRowAction();
  const isAdmin = viewerRole === "admin";
  const canEnter = status === "active" || status === "past_due";
  const live = subscriptionId !== null && status !== null && status !== "canceled";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {canEnter && <BypassDialog userId={userId} memberName={memberName} row={row} />}
        {isAdmin && live && status === "active" && !cancelAtPeriodEnd && (
          <FreezeDialog subscriptionId={subscriptionId} memberName={memberName} row={row} />
        )}
        {isAdmin && live && status === "paused" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.pending}
            onClick={() => row.run(() => unfreezeMemberSubscription(subscriptionId))}
            title="Dondurmayı kaldır"
          >
            <Sun /> <span className="sr-only xl:not-sr-only">Çöz</span>
          </Button>
        )}
        {isAdmin && live && cancelAtPeriodEnd && (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.pending}
            onClick={() => row.run(() => resumeMemberSubscription(subscriptionId))}
            title="Planlanmış iptali geri al"
          >
            <Undo2 /> <span className="sr-only xl:not-sr-only">Geri al</span>
          </Button>
        )}
        {isAdmin && live && (
          <CancelDialog
            subscriptionId={subscriptionId}
            memberName={memberName}
            cancelAtPeriodEnd={cancelAtPeriodEnd}
            row={row}
          />
        )}
      </div>
      {row.result && (
        <p role="status" className={cn("max-w-56 text-right text-xs", row.result.ok ? "text-success" : "text-destructive")}>
          {row.result.message}
        </p>
      )}
    </div>
  );
}

type Row = ReturnType<typeof useRowAction>;

function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  row,
  onConfirm,
  onOpen,
  children,
}: {
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  row: Row;
  onConfirm: (close: () => void) => void;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (row.pending) return;
        setOpen(next);
        if (next) {
          row.setResult(null);
          onOpen?.();
        }
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {open && row.result && !row.result.ok && (
          <p role="alert" className="text-sm text-destructive">
            {row.result.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={row.pending}>Vazgeç</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={row.pending}
            onClick={() => onConfirm(() => setOpen(false))}
          >
            {row.pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BypassDialog({ userId, memberName, row }: { userId: string; memberName: string; row: Row }) {
  const [note, setNote] = useState("");
  return (
    <ActionDialog
      trigger={
        <Button variant="ghost" size="sm" title="Manuel geçiş">
          <DoorOpen /> <span className="sr-only xl:not-sr-only">Geçiş</span>
        </Button>
      }
      title="Manuel geçiş"
      description={
        <>
          <span className="font-medium text-foreground">{memberName}</span> için başarılı bir giriş kaydı oluşturulacak ve
          adınla birlikte geçiş geçmişine yazılacak. Turnikeyi elle açmayı unutma.
        </>
      }
      confirmLabel="Girişi kaydet"
      row={row}
      onOpen={() => setNote("")}
      onConfirm={(close) => row.run(() => manualBypass(userId, note), close)}
    >
      <div className="space-y-2">
        <label htmlFor={`note-${userId}`} className="text-sm font-medium">
          Not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
        </label>
        <input
          id={`note-${userId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MANUAL_NOTE_MAX_LENGTH}
          placeholder="Ör. telefonunu unuttu, turnike arızalı"
          disabled={row.pending}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </ActionDialog>
  );
}

function FreezeDialog({ subscriptionId, memberName, row }: { subscriptionId: string; memberName: string; row: Row }) {
  const [days, setDays] = useState<number | null>(14);
  return (
    <ActionDialog
      trigger={
        <Button variant="ghost" size="sm" title="Üyeliği dondur">
          <Snowflake /> <span className="sr-only xl:not-sr-only">Dondur</span>
        </Button>
      }
      title="Üyeliği dondur"
      description={
        <>
          <span className="font-medium text-foreground">{memberName}</span> dondurma süresince ücretlendirilmez ve QR ile
          giriş yapamaz. Süre bitince üyelik kendiliğinden devam eder.
        </>
      }
      confirmLabel="Dondur"
      row={row}
      onOpen={() => setDays(14)}
      onConfirm={(close) => row.run(() => freezeMemberSubscription(subscriptionId, days), close)}
    >
      <OptionList
        name={`freeze-${subscriptionId}`}
        legend="Dondurma süresi"
        disabled={row.pending}
        options={FREEZE_OPTIONS.map((o) => ({ key: String(o.value), title: o.label, checked: days === o.value, onSelect: () => setDays(o.value) }))}
      />
    </ActionDialog>
  );
}

function CancelDialog({
  subscriptionId,
  memberName,
  cancelAtPeriodEnd,
  row,
}: {
  subscriptionId: string;
  memberName: string;
  cancelAtPeriodEnd: boolean;
  row: Row;
}) {
  const initial: CancelMode = cancelAtPeriodEnd ? "now" : "period_end";
  const [mode, setMode] = useState<CancelMode>(initial);
  return (
    <ActionDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Aboneliği iptal et">
          <Ban /> <span className="sr-only xl:not-sr-only">İptal</span>
        </Button>
      }
      title="Abonelik iptali"
      description={
        <>
          <span className="font-medium text-foreground">{memberName}</span> adlı üyenin aboneliği Stripe üzerinden iptal
          edilecek. Bu işlem geri alınamaz; üye yeniden abone olmak zorunda kalır.
        </>
      }
      confirmLabel={mode === "now" ? "Hemen iptal et" : "Dönem sonunda iptal et"}
      destructive
      row={row}
      onOpen={() => setMode(initial)}
      onConfirm={(close) => row.run(() => cancelMemberSubscription(subscriptionId, mode), close)}
    >
      <OptionList
        name={`cancel-${subscriptionId}`}
        legend="İptal türü"
        disabled={row.pending}
        options={CANCEL_MODES.map((m) => {
          const unavailable = m.value === "period_end" && cancelAtPeriodEnd;
          return {
            key: m.value,
            title: m.title,
            description: unavailable ? "Zaten dönem sonunda bitecek şekilde ayarlı." : m.description,
            checked: mode === m.value,
            disabled: unavailable,
            onSelect: () => setMode(m.value),
          };
        })}
      />
    </ActionDialog>
  );
}

function OptionList({
  name,
  legend,
  disabled,
  options,
}: {
  name: string;
  legend: string;
  disabled: boolean;
  options: { key: string; title: string; description?: string; checked: boolean; disabled?: boolean; onSelect: () => void }[];
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.key}
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors has-checked:border-primary has-checked:bg-primary/5",
            o.disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={o.checked}
            disabled={o.disabled}
            onChange={o.onSelect}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="block font-medium">{o.title}</span>
            {o.description && <span className="text-muted-foreground">{o.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
