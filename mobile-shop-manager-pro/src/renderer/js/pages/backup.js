'use strict';
App.pages.backup = {
  title: 'Backup & Restore', icon: 'database',
  async backupNow() { try { const b = await api('backup:create'); toast(t('Backup saved to {file}', { file: b.file })); refreshBadges(); return b; } catch (e) { fail(e); return null; } },
  async render(root) {
    const size = n => n > 1048576 ? numf(n / 1048576, 1) + ' MB' : numf(n / 1024, 0) + ' KB';
    const typeName = { manual: t('Manual'), auto: t('Automatic'), safety: t('Safety (before restore)') };
    const body = h('div');
    const restore = async info => {
      const c = info.counts;
      const v = await confirmDialog({ title: t('Restore this backup?'), danger: true, confirmLabel: t('Restore backup'),
        text: h('div', null, h('p', { style: { marginTop: 0 } }, t('All current data will be replaced with the contents of this backup:')),
          kv([[t('File'), info.file.split(/[\\/]/).pop()], [t('Saved'), fdatetime(info.modified)], [t('Contains'), t('{m} mobiles, {a} accessories, {c} customers, {s} sales, {e} expenses', { m: c.mobiles, a: c.accessories, c: c.customers, s: c.sales, e: c.expenses })]]),
          h('p', { class: 'note', style: { marginBottom: 0 } }, t('A safety backup of your current data is created automatically first, so this can be undone.'))),
        fields: await adminFields() });
      if (!v) return;
      try { const r = await api('backup:restore', { file: info.file, password: v.password }); toast(t('Backup restored. Safety copy: {file}', { file: r.safety_backup }), 'ok', 8000); await bootstrap(); navigate('backup'); } catch (e) { fail(e); }
    };
    const draw = async () => {
      let d; try { d = await api('backup:list'); } catch (e) { return fail(e); }
      const S = App.settings;
      const importBtn = (entity, lbl) => h('div', { class: 'row between', style: { padding: '8px 0', borderBottom: '1px solid var(--line-2)' } }, h('b', null, lbl), h('div', { class: 'row' },
        btn(t('Template'), 'download', 'sm ghost', async () => { try { const f = await api('backup:template', entity); if (f) toast(t('Saved to {file}', { file: f })); } catch (e) { fail(e); } }),
        btn(t('Import CSV'), 'upload', 'sm', async () => { if (restricted()) return; try { const r = await api('backup:importCsv', entity); if (!r) return;
          modal({ title: t('Import finished'), size: 'sm', body: h('div', { class: 'col' }, h('div', null, t('{n} rows imported, {s} skipped.', { n: r.imported, s: r.skipped })), r.errors.length ? h('div', { class: 'note warn', style: { maxHeight: '220px', overflow: 'auto' } }, r.errors.map(e => h('div', null, t('Row {n}: {msg}', { n: e.row, msg: t(e.message) })))) : null) }); } catch (e) { fail(e); } })));
      body.replaceChildren(
        h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(3,minmax(0,1fr))' } },
          statCard(t('Last backup'), d.last ? fdatetime(d.last.created_at) : t('Never'), { ico: 'database', color: d.last ? 'green' : 'red', sub: d.last ? typeName[d.last.backup_type] : t('Create your first backup now.') }),
          statCard(t('Automatic backup'), { off: t('Off'), daily: t('Daily'), weekly: t('Weekly') }[S.auto_backup], { ico: 'refresh', color: S.auto_backup === 'off' ? 'amber' : 'slate', sub: t('Keeps the latest {n} automatic backups', { n: S.backup_keep }) }),
          statCard(t('Backups on record'), numf(d.history.length), { ico: 'layers', color: 'slate' })),
        h('div', { class: 'grid g2', style: { marginBottom: '14px' } },
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('h3', null, t('Back up'))), h('div', { class: 'bd col' },
            h('div', { class: 'field' }, h('label', null, t('Backup folder')), h('div', { class: 'row' }, h('input', { class: 'input', readOnly: true, value: d.folder }), btn(t('Change'), 'folder', '', async () => { try { const f = await api('backup:chooseFolder'); if (f) { App.settings = await api('settings:get'); draw(); } } catch (e) { fail(e); } }), iconBtn('eye', t('Open folder'), () => api('backup:openFolder').catch(fail)))),
            h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', null, t('Automatic backup')), (() => { const s = h('select', { class: 'input', onchange: async () => { App.settings = await api('settings:update', { auto_backup: s.value }); draw(); } }, [['daily', t('Daily')], ['weekly', t('Weekly')], ['off', t('Off')]].map(o => h('option', { value: o[0] }, o[1]))); s.value = S.auto_backup; return s; })()),
              h('div', { class: 'field' }, h('label', null, t('Automatic backups to keep')), h('input', { class: 'input', type: 'number', min: '1', max: '365', value: S.backup_keep, onchange: async e => { try { App.settings = await api('settings:update', { backup_keep: e.target.value }); } catch (er) { fail(er); } } }))),
            h('div', { class: 'row' }, btn(t('Back up now'), 'database', 'primary', async () => { if (await App.pages.backup.backupNow()) draw(); }), h('span', { class: 'small muted' }, t('Tip: point the backup folder at a USB drive or a cloud-synced folder.'))))),
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('h3', null, t('Restore'))), h('div', { class: 'bd col' },
            h('div', { class: 'note warn' }, t('Restoring replaces all current data with the backup. The file is validated first and a safety backup of your current data is always created.')),
            h('div', null, btn(t('Restore from a backup file…'), 'upload', '', async () => { try { const info = await api('backup:pickFile'); if (info) restore(info); } catch (e) { fail(e); } }))))),
        h('div', { class: 'grid g2', style: { marginBottom: '14px' } },
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Export data to CSV')), h('p', null, t('One spreadsheet-ready file per table: inventory, customers, sales, ledgers and more.')))), h('div', { class: 'bd' }, btn(t('Export all data as CSV…'), 'download', '', async () => { try { const r = await api('backup:exportCsv'); if (r) { toast(t('{n} CSV files saved to {folder}', { n: r.files, folder: r.folder })); api('shell:showFile', r.folder); } } catch (e) { fail(e); } }))),
          h('div', { class: 'card' }, h('div', { class: 'hd' }, h('div', null, h('h3', null, t('Import from CSV')), h('p', null, t('Download a template, fill it in, then import. Invalid or duplicate rows are skipped and listed.')))), h('div', { class: 'bd' }, importBtn('mobiles', t('Mobiles')), importBtn('accessories', t('Accessories')), importBtn('customers', t('Customers')), importBtn('suppliers', t('Suppliers'))))),
        h('div', { class: 'card' }, h('div', { class: 'hd' }, h('h3', null, t('Backup history'))), h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, t('Date and time')), h('th', null, t('Type')), h('th', null, t('File')), h('th', { class: 'num' }, t('Size')), h('th'))),
          h('tbody', null, d.history.length ? d.history.map(b => h('tr', null, h('td', { class: 'nowrap' }, fdatetime(b.created_at)), h('td', null, badge(typeName[b.backup_type], b.backup_type === 'manual' ? 'blue' : b.backup_type === 'safety' ? 'amber' : '')),
            h('td', { style: { wordBreak: 'break-all' } }, b.file_path, b.exists ? null : [' ', badge(t('File missing'), 'red')]), h('td', { class: 'num' }, size(b.size_bytes)),
            h('td', null, h('div', { class: 'acts' }, b.exists ? [iconBtn('folder', t('Show in folder'), () => api('shell:showFile', b.file_path)), btn(t('Restore'), 'upload', 'sm', async () => { try { restore(await api('backup:validate', b.file_path)); } catch (e) { fail(e); } })] : null))))
            : h('tr', null, h('td', { colspan: 5 }, h('div', { class: 'empty' }, icon('database'), h('b', null, t('No backups yet')), t('Click “Back up now” to create one.')))))))));
    };
    root.append(pageHead(t('Backup & Restore'), t('Your data is stored only on this computer. Back it up regularly.')), body);
    await draw();
  },
};
