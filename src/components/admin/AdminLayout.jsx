/** Add this file to the SAME Apps Script project as CODA_calendar_attendance_sync.gs.
 * Requires Advanced Google service: Calendar API.
 * Deploy web app with restricted access; never publish to everyone.
 * Calendar events themselves cannot host custom buttons; this is a companion web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('CODA_Attendance_UI')
    .setTitle('CODA 출석 관리')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function codaListForButtons(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('날짜 형식 오류');
  const events=listCODAEvents_(day+'T00:00:00+09:00',day+'T23:59:59+09:00');
  return events.filter(e=>e.status!=='cancelled').map(e=>({
    id:e.id,title:e.summary||'',date:eventDate_(e),colorId:String(e.colorId||''),
    attendance:codaEffectiveAttendance_(e),
    content:parseCODADescription_(e.description||'').content,
    names:parseCODANames_(e.summary||'')
  }));
}
function codaSaveFromButtons(payload) {
  const r = codaSaveBatchFromButtons([payload]);
  if (r.failed) throw new Error(r.results[0].error || '저장 실패');
  return {ok:true, warnings:r.warnings || []};
}
