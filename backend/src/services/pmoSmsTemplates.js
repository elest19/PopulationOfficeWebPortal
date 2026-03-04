function formatDate(isoOrDate) {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTimeRange(startTime, endTime) {
  const st = startTime ? String(startTime).slice(0, 5) : null;
  const et = endTime ? String(endTime).slice(0, 5) : null;
  if (!st && !et) return null;
  if (st && et) return `${st} - ${et}`;
  return st || et;
}

function buildReference(referenceNumber, appointmentId) {
  return referenceNumber || appointmentId || '';
}

function bookingConfirmation() {
  return (
    'Good day.\n' +
    'Your request for a Pre-Marriage Orientation appointment has been successfully received by the Municipal Office of Population.\n' +
    '{names_line}\n' +
    '{schedule_line}\n' +
    'Please wait for further updates regarding your appointment status. Thank you.'
  );
}

function accepted({ referenceNumber, appointmentId, date, startTime, endTime }) {
  const ref = buildReference(referenceNumber, appointmentId);
  const d = formatDate(date);
  const t = formatTimeRange(startTime, endTime);
  const scheduleLine = d || t ? `Schedule: ${d || 'TBA'}${t ? ` | ${t}` : ''}` : null;
  return (
    'Good day.\n' +
    'Your Pre-Marriage Orientation appointment has been APPROVED.\n' +
    '{names_line}\n' +
    (scheduleLine ? `${scheduleLine}\n` : '{schedule_line}\n') +
    '{reference_number_line}\n' +
    'Please arrive on time and bring the required documents. Thank you.'
  );
}

function rejected({ rejectReason }) {
  // Reason text is passed separately and also available to templates via {reject_reason}.
  // We intentionally do not include any reference number in rejected messages.
  return (
    'Good day.\n' +
    'Your Pre-Marriage Orientation appointment has been DISAPPROVED.\n' +
    '{names_line}\n' +
    (rejectReason ? `Reason: {reject_reason}\n` : '') +
    'You may submit a new request or contact the Municipal Office for assistance.'
  );
}

function cancelled({ rejectReason }) {
  // Cancelled messages also do not include a reference number.
  return (
    'Good day.\n' +
    'Your Pre-Marriage Orientation appointment has been CANCELLED.\n' +
    '{names_line}\n' +
    '{schedule_line}\n' +
    (rejectReason ? `Reason: {reject_reason}\n` : '') +
    'If you wish to rebook, please visit the official portal. Thank you.'
  );
}

module.exports = {
  bookingConfirmation,
  accepted,
  rejected,
  cancelled,
};
