import React, { useState } from 'react';
import { Flag, X, AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from './ui/Button';
import { REPORT_ENDPOINTS } from '../config/api';
import { auth } from '../lib/firebase';
import { ReportReason } from '../types';

interface ReportListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  onReportSuccess?: () => void;
}

const REPORT_REASONS: ReportReason[] = [
  'Prohibited item',
  'Scam/fraud',
  'Fake/misleading listing',
  'Unsafe item',
  'Other',
];

export function ReportListingModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  onReportSuccess,
}: ReportListingModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('Prohibited item');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsDuplicate(false);
    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to submit a listing report.');
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch(REPORT_ENDPOINTS.submit, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          listingId,
          reason: selectedReason,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isDuplicate) {
          setIsDuplicate(true);
          setError(data.error);
        } else {
          setError(data.error || 'Failed to submit report. Please try again.');
        }
        return;
      }

      setIsSuccess(true);
      if (onReportSuccess) {
        onReportSuccess();
      }
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Report submission error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173e2d]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-[#dedcd4]">
        <div className="flex items-center justify-between pb-4 border-b border-[#dedcd4]">
          <div className="flex items-center gap-2 text-[#252b27]">
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Report Listing</h3>
              <p className="text-xs text-[#717870] line-clamp-1 max-w-[280px]">
                {listingTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-[#717870] hover:bg-[#edf1ec] hover:text-[#204b39] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#edf1ec] text-[#204b39] border border-[#dedcd4]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-[#252b27]">Report Submitted</h4>
            <p className="text-xs text-[#717870] max-w-xs mx-auto">
              Thank you for keeping StudentNeed safe. Campus moderators have been notified and will review this listing shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div
                className={`flex items-start gap-2.5 rounded-xl p-3 text-xs leading-relaxed ${
                  isDuplicate
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {isDuplicate ? (
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#252b27] uppercase tracking-wider mb-2">
                Reason for reporting
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                      selectedReason === r
                        ? 'border-[#204b39] bg-[#edf1ec]/60 font-medium text-[#252b27] ring-1 ring-[#204b39]/20'
                        : 'border-[#dedcd4] hover:bg-[#faf9f5] text-[#555d56]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="accent-[#204b39]"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252b27] uppercase tracking-wider mb-1.5">
                Additional Details (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Provide any specific context or details to help moderators review..."
                className="w-full rounded-xl border border-[#dedcd4] bg-[#faf9f5] p-3 text-xs outline-none focus:border-[#204b39] focus:bg-white focus:ring-2 focus:ring-[#204b39]/20 transition-all resize-none text-[#252b27]"
              />
              <p className="text-[10px] text-[#717870] text-right mt-1">
                {description.length}/400
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#dedcd4] text-[#555d56] hover:bg-[#edf1ec] hover:text-[#204b39]"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1 gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
