/* ═══════════════════════════════════════════════
   Home OS — Dokumenty (přílohy)
   Použití:
     Docs.open('contract', id, 'Název')   — standalone modal
     Docs.renderInto('health', id, 'container-id') — inline v jiném modalu
     Docs.uploadFiles('health', id, fileList)       — bulk upload po uložení
   ═══════════════════════════════════════════════ */

const Docs = (() => {

  const SETUP_SQL = `CREATE TABLE IF NOT EXISTS document_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  file_name    text NOT NULL,
  file_path    text NOT NULL,
  file_size    integer,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON document_attachments
  FOR ALL USING (auth.role() = 'authenticated');`;

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtSize(b) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(0)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  }

  // ── Standalone modal ──────────────────────────
  async function open(entityType, entityId, entityName) {
    App.openModal(
      `📎 Přílohy — ${esc(entityName)}`,
      `<div id="docs-modal-body"><div class="loading"><div class="spinner"></div> Načítám…</div></div>`,
      { saveLabel: null }
    );
    await renderInto(entityType, entityId, 'docs-modal-body');
  }

  // ── Inline uvnitř jiného modalu ───────────────
  async function renderInto(entityType, entityId, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const { data, error } = await db
      .from('document_attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      const isTableMissing = error.message?.includes('schema cache') || error.code === '42P01';
      if (isTableMissing) {
        el.innerHTML = _setupNeededHtml();
      } else {
        el.innerHTML = `<div style="color:var(--danger);font-size:.8rem;padding:.5rem 0">Chyba: ${esc(error.message)}</div>`;
      }
      return;
    }

    const inputId = `docs-input-${containerId}`;
    let html = '';

    if (data?.length) {
      html += `<div style="display:flex;flex-direction:column;gap:.375rem;margin-bottom:.75rem">`;
      data.forEach(doc => {
        const ext = doc.file_name.split('.').pop().toUpperCase();
        const extColor = ext==='PDF' ? '#ef4444' : ext.match(/^(JPG|JPEG|PNG|WEBP)$/) ? '#3b82f6' : '#94a3b8';
        html += `<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .625rem;background:var(--surface2);border-radius:6px">
          <span style="font-size:.65rem;font-weight:700;background:${extColor};color:#fff;padding:.1rem .3rem;border-radius:3px;flex-shrink:0">${esc(ext)}</span>
          <div style="flex:1;min-width:0;font-size:.825rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(doc.file_name)}</div>
          ${doc.file_size ? `<span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0">${fmtSize(doc.file_size)}</span>` : ''}
          <button class="btn btn-icon btn-ghost btn-sm" title="Stáhnout" onclick="Docs._download('${esc(doc.file_path)}','${esc(doc.file_name)}')">⬇</button>
          <button class="btn btn-icon btn-ghost btn-sm" style="color:var(--danger)" title="Smazat" onclick="Docs._deleteInline('${esc(doc.id)}','${esc(entityType)}','${esc(entityId)}','${esc(containerId)}')">🗑️</button>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem">Zatím žádné přílohy.</div>`;
    }

    html += `<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
      <input type="file" id="${inputId}" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" class="form-control" style="padding:.375rem;font-size:.8rem;flex:1;min-width:180px">
      <button class="btn btn-sm btn-outline" onclick="Docs._uploadFromInput('${esc(entityType)}','${esc(entityId)}','${esc(containerId)}','${esc(inputId)}')">📎 Nahrát</button>
    </div>`;

    el.innerHTML = html;
  }

  function _setupNeededHtml() {
    return `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:.75rem;font-size:.8rem">
      <div style="font-weight:600;color:#92400e;margin-bottom:.375rem">⚠️ Tabulka neexistuje — spusťte tento SQL v Supabase</div>
      <pre style="background:#fff7ed;border-radius:4px;padding:.5rem;font-size:.72rem;overflow-x:auto;color:#78350f;margin:0;white-space:pre-wrap">${esc(SETUP_SQL)}</pre>
      <div style="margin-top:.5rem;color:#92400e">Supabase Dashboard → SQL Editor → vložte výše a klikněte <strong>Run</strong>.<br>
      Pak vytvořte Storage bucket <strong>documents</strong> (Private).</div>
    </div>`;
  }

  // ── Upload z konkrétního input elementu ───────
  async function _uploadFromInput(entityType, entityId, containerId, inputId) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file) { App.toast('Vyberte soubor.', 'error'); return; }
    await _uploadSingleFile(entityType, entityId, file);
    await renderInto(entityType, entityId, containerId);
  }

  // ── Bulk upload po uložení záznamu ────────────
  async function uploadFiles(entityType, entityId, fileList) {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) {
        App.toast(`${file.name}: příliš velký (max 10 MB)`, 'error');
        continue;
      }
      await _uploadSingleFile(entityType, entityId, file);
    }
  }

  async function _uploadSingleFile(entityType, entityId, file) {
    if (file.size > 10 * 1024 * 1024) { App.toast('Soubor je příliš velký (max 10 MB).', 'error'); return false; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${entityType}/${entityId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await db.storage.from('documents').upload(path, file);
    if (upErr) { App.toast(`Chyba nahrávání ${file.name}: ${upErr.message}`, 'error'); return false; }

    const { error: dbErr } = await db.from('document_attachments').insert({
      entity_type: entityType, entity_id: entityId,
      file_name: file.name, file_path: path, file_size: file.size,
    });
    if (dbErr) {
      await db.storage.from('documents').remove([path]);
      App.toast(`Chyba záznamu: ${dbErr.message}`, 'error');
      return false;
    }
    return true;
  }

  // ── Standalone upload (z modal příloh) ───────
  async function _upload(entityType, entityId, entityName) {
    const input = document.getElementById('docs-file-input');
    const file = input?.files?.[0];
    if (!file) { App.toast('Vyberte soubor.', 'error'); return; }
    const ok = await _uploadSingleFile(entityType, entityId, file);
    if (ok) {
      App.toast('Soubor nahrán ✓', 'success');
      await renderInto(entityType, entityId, 'docs-modal-body');
    }
  }

  // ── Download ──────────────────────────────────
  async function _download(path, fileName) {
    const { data, error } = await db.storage.from('documents').download(path);
    if (error) { App.toast('Chyba stahování.', 'error'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ── Delete (inline — re-render do containeru) ─
  async function _deleteInline(id, entityType, entityId, containerId) {
    if (!confirm('Smazat tuto přílohu?')) return;
    const { data: doc } = await db.from('document_attachments').select('file_path').eq('id', id).single();
    if (doc?.file_path) await db.storage.from('documents').remove([doc.file_path]);
    await db.from('document_attachments').delete().eq('id', id);
    App.toast('Příloha smazána.', '');
    await renderInto(entityType, entityId, containerId);
  }

  // ── Delete (standalone modal) ─────────────────
  async function _delete(id, entityType, entityId, entityName) {
    if (!confirm('Smazat tuto přílohu?')) return;
    const { data: doc } = await db.from('document_attachments').select('file_path').eq('id', id).single();
    if (doc?.file_path) await db.storage.from('documents').remove([doc.file_path]);
    await db.from('document_attachments').delete().eq('id', id);
    App.toast('Příloha smazána.', '');
    await renderInto(entityType, entityId, 'docs-modal-body');
  }

  return { open, renderInto, uploadFiles, _upload, _uploadFromInput, _download, _delete, _deleteInline };
})();
