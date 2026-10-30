import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X, Loader2, ShieldAlert } from 'lucide-react';
import { GenUIConfirmationDialogComponent } from '../../types/genui';
import { useAppContext } from '../../context/AppContext';
import { RESERVATION_ENDPOINTS } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

interface GenUIConfirmationDialogProps {
  spec: GenUIConfirmationDialogComponent;
  onDismiss?: () => void;
  onConfirmed?: () => void;
}

export function GenUIConfirmationDialog({ spec, onDismiss, onConfirmed }: GenUIConfirmationDialogProps) {
  const { cancelRequest } = useAppContext();
  const { firebaseUser } = useAuth();

  const [selectedReason, setSelectedReason] = useState(
    spec.reasonOptions && spec.reasonOptions.length > 0 ? spec.reasonOptions[0] : ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safeguard: Check that the current state permits cancellation (prevent invalid state transitions)
  const allowedStatuses = ['pending', 'open', 'active'];
  const canCancel = allowedStatuses.includes(spec.itemDetails.currentStatus.toLowerCase());

  const handleConfirm = async () => {
    if (isProcessing || isSuccess) return; // Prevent duplicate submissions

    if (!canCancel) {
      setErrorMessage(`Cannot cancel item with status '${spec.itemDetails.currentStatus}'. Only pending or active items can be cancelled.`);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (spec.actionType === 'cancel_request') {
        // Real AppContext call to Firestore
        await cancelRequest(spec.itemDetails.id);
      } else if (spec.actionType === 'cancel_reservation') {
        // Real API call to server reservation cancellation endpoint if token available
        const token = await firebaseUser?.getIdToken();
        if (token) {
          const res = await fetch(RESERVATION_ENDPOINTS.cancel, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              reservationId: spec.itemDetails.id,
              reason: selectedReason
            })
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to cancel reservation on server.');
          }
        }
      }

      setIsSuccess(true);
      if (onConfirmed) onConfirmed();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to execute cancellation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAbort = () => {
    setIsAborted(true);
    if (onDismiss) onDismiss();
  };

  if (isAborted) {
    return (
      <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-3 text-center text-xs text-[#555d56]">
        Action aborted. Your item remains active.
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h5 className="text-xs font-bold text-emerald-900">Cancelled Successfully</h5>
        <p className="text-[11px] text-emerald-800">
          {spec.itemDetails.title} has been safely cancelled and status updated.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby={`dialog_title_${spec.dialogId}`}
      aria-describedby={`dialog_desc_${spec.dialogId}`}
      className="space-y-3 rounded-2xl border border-red-200 bg-white p-4 shadow-sm"
    >
      {/* Alert Header */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h4 id={`dialog_title_${spec.dialogId}`} className="text-xs font-bold text-red-900">
            {spec.title}
          </h4>
          <p id={`dialog_desc_${spec.dialogId}`} className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
            {spec.warningMessage}
          </p>
        </div>
      </div>

      {/* Target Item Summary Card */}
      <div className="rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-2.5 text-xs space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#252b27] line-clamp-1">{spec.itemDetails.title}</span>
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 uppercase">
            {spec.itemDetails.currentStatus}
          </span>
        </div>
        <p className="text-[10px] text-[#555d56]">Reference ID: {spec.itemDetails.id}</p>
      </div>

      {/* Reason Selector */}
      {spec.requiresReason && spec.reasonOptions && (
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-[#252b27]">
            Cancellation Reason:
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            disabled={isProcessing}
            className="w-full rounded-lg border border-[#dedcd4] bg-white px-2.5 py-1.5 text-xs text-[#252b27] focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            {spec.reasonOptions.map((reason, idx) => (
              <option key={idx} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Error Feedback */}
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-[10px] text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleAbort}
          disabled={isProcessing}
          className="flex-1 rounded-lg border border-[#dedcd4] bg-white px-3 py-1.5 text-xs font-bold text-[#555d56] transition hover:bg-zinc-100 active:scale-98 disabled:opacity-50"
        >
          {spec.cancelButtonText || 'Keep Active'}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isProcessing || !canCancel}
          className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-red-700 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>{spec.confirmButtonText || 'Confirm'}</span>
          )}
        </button>
      </div>
    </div>
  );
}
