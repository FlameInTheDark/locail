package jobs

import (
    "context"
    "encoding/json"
    "fmt"
    "strings"
    "sync"
    "time"
    "locail/internal/domain"
    "locail/internal/ports"
    "locail/internal/usecase/translator"
    "locail/internal/adapters/llm/factory"
)

type Deps struct {
    Jobs        ports.JobRepository
    Files       ports.FileRepository
    Units       ports.UnitRepository
    Providers   ports.ProviderRepository
    Translations ports.TranslationRepository
    Prompt      ports.PromptRenderer
    Cache       ports.CacheRepository
}

type Runner struct {
    d      Deps
    trans  *translator.Service
    mu     sync.Mutex
    active map[int64]context.CancelFunc
    em     EventEmitter
}

func NewRunner(d Deps, trans *translator.Service) *Runner {
    return &Runner{d: d, trans: trans, active: map[int64]context.CancelFunc{}}
}

type EventEmitter interface {
    Emit(name string, payload any)
}

func (r *Runner) SetEmitter(em EventEmitter) { r.em = em }

type TranslateFileParams struct {
    FileID      int64   `json:"file_id"`
    TargetLocales []string `json:"target_locales"`
    Model       string  `json:"model"`
}

type TranslateUnitParams struct {
    UnitID       int64    `json:"unit_id"`
    Locales      []string `json:"locales"`
    Model        string   `json:"model"`
}

// TranslateUnitsParams describes a batch of specific units to translate sequentially.
type TranslateUnitsParams struct {
    UnitIDs      []int64  `json:"unit_ids"`
    Locales      []string `json:"locales"`
    Model        string   `json:"model"`
}

func (r *Runner) StartTranslateFile(ctx context.Context, projectID, providerID int64, p TranslateFileParams) (int64, error) {
    // Resolve model: if empty, use provider default
    if p.Model == "" {
        if prov, err := r.d.Providers.Get(ctx, providerID); err == nil && prov != nil {
            p.Model = prov.Model
        }
    }
    // Normalize model IDs for providers that expose labels (e.g., OpenRouter)
    if norm, err := r.normalizeModel(ctx, providerID, p.Model); err == nil && norm != "" {
        p.Model = norm
    }
    paramsJSON, _ := json.Marshal(p)
    job := &domain.Job{Type: "translate_file", Status: "queued", ProjectID: &projectID, ProviderID: &providerID, ParamsRaw: string(paramsJSON), Progress: 0, Total: 0}
    id, err := r.d.Jobs.Create(ctx, job)
    if err != nil { return 0, err }
    // Precompute total to reflect immediately in UI
    units, _ := r.d.Units.ListByFile(ctx, p.FileID)
    // Compute count of missing translations only
    total := 0
    for _, tgt := range p.TargetLocales {
        trs, _ := r.d.Translations.ListByFileLocale(ctx, p.FileID, tgt)
        have := make(map[int64]struct{}, len(trs))
        for _, t := range trs { have[t.UnitID] = struct{}{} }
        for _, u := range units { if _, ok := have[u.ID]; !ok { total++ } }
    }
    _ = r.d.Jobs.UpdateProgress(ctx, id, 0, total, "running")
    if r.em != nil { r.em.Emit("job.started", map[string]any{"job_id": id, "total": total, "model": p.Model, "provider_id": providerID}) }
    r.log(ctx, id, "info", fmt.Sprintf("job started: provider=%d model=%s units=%d locales=%d", providerID, p.Model, len(units), len(p.TargetLocales)))
    cctx, cancel := context.WithCancel(context.Background())
    r.mu.Lock(); r.active[id] = cancel; r.mu.Unlock()
    go r.runTranslateFile(cctx, id, providerID, p)
    return id, nil
}

// normalizeModel attempts to convert a possibly human-readable model label to a canonical ID
// for the specified provider. Returns the normalized model or empty string if unchanged.
func (r *Runner) normalizeModel(ctx context.Context, providerID int64, model string) (string, error) {
    m := model
    if strings.TrimSpace(m) == "" { return "", nil }
    prov, err := r.d.Providers.Get(ctx, providerID)
    if err != nil || prov == nil { return "", err }
    if strings.ToLower(prov.Type) != "openrouter" { return "", nil }
    // Heuristic: labels usually have spaces/parentheses; IDs don't
    if !strings.Contains(m, " ") && !strings.Contains(m, "(") && !strings.Contains(m, ")") {
        return "", nil // likely already an ID
    }
    adapter, ok := factory.FromProvider(prov)
    if !ok { return "", nil }
    list, err := adapter.ListModels(ctx)
    if err != nil { return "", err }
    for _, mi := range list {
        if strings.EqualFold(mi.Name, m) || strings.EqualFold(mi.Description, m) {
            return mi.Name, nil
        }
    }
    return "", nil
}

func (r *Runner) runTranslateFile(ctx context.Context, jobID, providerID int64, p TranslateFileParams) {
    // Load units
    units, err := r.d.Units.ListByFile(ctx, p.FileID)
    if err != nil { _ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: "error", Message: err.Error()}); _ = r.d.Jobs.UpdateProgress(ctx, jobID, 0, 0, "failed"); return }
    _ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: "info", Message: fmt.Sprintf("units=%d, locales=%d", len(units), len(p.TargetLocales))})
    total := len(units) * len(p.TargetLocales)
    done := 0
    _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
    for _, u := range units {
        select { case <-ctx.Done(): _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled"); return; default: }
        for _, tgt := range p.TargetLocales {
            // Skip if translation already exists for this unit/locale
            if t, _ := r.d.Translations.Get(ctx, u.ID, tgt); t != nil && strings.TrimSpace(t.Text) != "" {
                continue
            }
            item := &domain.JobItem{JobID: jobID, UnitID: &u.ID, Locale: &tgt, Status: "running"}
            itemID, _ := r.d.Jobs.AddItem(ctx, item)
            if r.em != nil { r.em.Emit("job.item.start", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "model": p.Model}) }
            r.log(ctx, jobID, "info", fmt.Sprintf("translate start: key=%s locale=%s model=%s", u.Key, tgt, p.Model))
            // Per-item timeout to avoid hangs
            ictx, cancel := context.WithTimeout(ctx, 60*time.Second)
            txt, err := r.trans.TranslateOne(ictx, translator.TranslateArgs{ProviderID: providerID, Unit: u, SourceLang: "", TargetLang: tgt, Model: p.Model})
            cancel()
            if err != nil {
                _ = r.d.Jobs.UpdateItem(ctx, itemID, "failed", err.Error())
                _ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: "error", Message: fmt.Sprintf("%s -> %s: %v", u.Key, tgt, err)})
                if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "error": err.Error(), "model": p.Model}) }
            } else {
                tr := &domain.Translation{UnitID: u.ID, Locale: tgt, Text: txt, Status: "machine"}
                _ = r.d.Translations.Upsert(ctx, tr)
                _ = r.d.Jobs.UpdateItem(ctx, itemID, "done", "")
                if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "text": txt, "model": p.Model}) }
                r.log(ctx, jobID, "info", fmt.Sprintf("translate done: key=%s locale=%s len=%d", u.Key, tgt, len(txt)))
            }
            done++
            _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
            if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "running", "model": p.Model}) }
        }
    }
    _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
    if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "done", "model": p.Model}) }
}

// StartTranslateUnit creates a job to translate a single unit for given locales, skipping those that already have a translation.
func (r *Runner) StartTranslateUnit(ctx context.Context, projectID, providerID int64, p TranslateUnitParams) (int64, error) {
    // Resolve model: if empty, use provider default
    if p.Model == "" {
        if prov, err := r.d.Providers.Get(ctx, providerID); err == nil && prov != nil { p.Model = prov.Model }
    }
    if norm, err := r.normalizeModel(ctx, providerID, p.Model); err == nil && norm != "" { p.Model = norm }
    // Compute missing locales for this unit
    miss := make([]string, 0, len(p.Locales))
    for _, tgt := range p.Locales {
        if t, _ := r.d.Translations.Get(ctx, p.UnitID, tgt); t == nil || strings.TrimSpace(t.Text) == "" {
            miss = append(miss, tgt)
        }
    }
    paramsJSON, _ := json.Marshal(p)
    job := &domain.Job{Type: "translate_unit", Status: "queued", ProjectID: &projectID, ProviderID: &providerID, ParamsRaw: string(paramsJSON), Progress: 0, Total: len(miss)}
    id, err := r.d.Jobs.Create(ctx, job)
    if err != nil { return 0, err }
    _ = r.d.Jobs.UpdateProgress(ctx, id, 0, len(miss), "running")
    if r.em != nil { r.em.Emit("job.started", map[string]any{"job_id": id, "total": len(miss), "model": p.Model, "provider_id": providerID}) }
    r.log(ctx, id, "info", fmt.Sprintf("job started: provider=%d model=%s unit=%d locales=%d", providerID, p.Model, p.UnitID, len(miss)))
    cctx, cancel := context.WithCancel(context.Background())
    r.mu.Lock(); r.active[id] = cancel; r.mu.Unlock()
    go r.runTranslateUnit(cctx, id, providerID, p, miss)
    return id, nil
}

func (r *Runner) runTranslateUnit(ctx context.Context, jobID, providerID int64, p TranslateUnitParams, locales []string) {
    // Load unit
    u, err := r.d.Units.Get(ctx, p.UnitID)
    if err != nil || u == nil { _ = r.d.Jobs.UpdateProgress(ctx, jobID, 0, 0, "failed"); return }
    total := len(locales)
    done := 0
    for _, tgt := range locales {
        select { case <-ctx.Done(): _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled"); return; default: }
        item := &domain.JobItem{JobID: jobID, UnitID: &u.ID, Locale: &tgt, Status: "running"}
        itemID, _ := r.d.Jobs.AddItem(ctx, item)
        if r.em != nil { r.em.Emit("job.item.start", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "model": p.Model}) }
        r.log(ctx, jobID, "info", fmt.Sprintf("translate start: key=%s locale=%s model=%s", u.Key, tgt, p.Model))
        ictx, cancel := context.WithTimeout(ctx, 60*time.Second)
        txt, err := r.trans.TranslateOne(ictx, translator.TranslateArgs{ProviderID: providerID, Unit: u, SourceLang: "", TargetLang: tgt, Model: p.Model})
        cancel()
        if err != nil {
            _ = r.d.Jobs.UpdateItem(ctx, itemID, "failed", err.Error())
            _ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: "error", Message: fmt.Sprintf("%s -> %s: %v", u.Key, tgt, err)})
            if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "error": err.Error(), "model": p.Model}) }
        } else {
            tr := &domain.Translation{UnitID: u.ID, Locale: tgt, Text: txt, Status: "machine"}
            _ = r.d.Translations.Upsert(ctx, tr)
            _ = r.d.Jobs.UpdateItem(ctx, itemID, "done", "")
            if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "text": txt, "model": p.Model}) }
            r.log(ctx, jobID, "info", fmt.Sprintf("translate done: key=%s locale=%s len=%d", u.Key, tgt, len(txt)))
        }
        done++
        _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
        if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "running", "model": p.Model}) }
    }
    _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
    if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "done", "model": p.Model}) }
}

// StartTranslateUnits creates a single job to translate multiple specific units sequentially for given locales.
func (r *Runner) StartTranslateUnits(ctx context.Context, projectID, providerID int64, p TranslateUnitsParams) (int64, error) {
    // Resolve/normalize model
    if p.Model == "" {
        if prov, err := r.d.Providers.Get(ctx, providerID); err == nil && prov != nil { p.Model = prov.Model }
    }
    if norm, err := r.normalizeModel(ctx, providerID, p.Model); err == nil && norm != "" { p.Model = norm }
    // Compute total missing items
    total := 0
    for _, uid := range p.UnitIDs {
        for _, tgt := range p.Locales {
            if t, _ := r.d.Translations.Get(ctx, uid, tgt); t == nil || strings.TrimSpace(t.Text) == "" {
                total++
            }
        }
    }
    paramsJSON, _ := json.Marshal(p)
    job := &domain.Job{Type: "translate_units", Status: "queued", ProjectID: &projectID, ProviderID: &providerID, ParamsRaw: string(paramsJSON), Progress: 0, Total: total}
    id, err := r.d.Jobs.Create(ctx, job)
    if err != nil { return 0, err }
    _ = r.d.Jobs.UpdateProgress(ctx, id, 0, total, "running")
    if r.em != nil { r.em.Emit("job.started", map[string]any{"job_id": id, "total": total, "model": p.Model, "provider_id": providerID}) }
    cctx, cancel := context.WithCancel(context.Background())
    r.mu.Lock(); r.active[id] = cancel; r.mu.Unlock()
    go r.runTranslateUnits(cctx, id, providerID, p)
    return id, nil
}

func (r *Runner) runTranslateUnits(ctx context.Context, jobID, providerID int64, p TranslateUnitsParams) {
    done := 0
    total := 0
    for range p.UnitIDs {
        for range p.Locales { total++ }
    }
    for _, uid := range p.UnitIDs {
        select { case <-ctx.Done(): _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled"); return; default: }
        u, err := r.d.Units.Get(ctx, uid)
        if err != nil || u == nil { continue }
        for _, tgt := range p.Locales {
            // Skip existing
            if t, _ := r.d.Translations.Get(ctx, u.ID, tgt); t != nil && strings.TrimSpace(t.Text) != "" {
                continue
            }
            item := &domain.JobItem{JobID: jobID, UnitID: &u.ID, Locale: &tgt, Status: "running"}
            itemID, _ := r.d.Jobs.AddItem(ctx, item)
            if r.em != nil { r.em.Emit("job.item.start", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "model": p.Model}) }
            ictx, cancel := context.WithTimeout(ctx, 60*time.Second)
            txt, err := r.trans.TranslateOne(ictx, translator.TranslateArgs{ProviderID: providerID, Unit: u, SourceLang: "", TargetLang: tgt, Model: p.Model})
            cancel()
            if err != nil {
                _ = r.d.Jobs.UpdateItem(ctx, itemID, "failed", err.Error())
                if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "error": err.Error(), "model": p.Model}) }
            } else {
                tr := &domain.Translation{UnitID: u.ID, Locale: tgt, Text: txt, Status: "machine"}
                _ = r.d.Translations.Upsert(ctx, tr)
                _ = r.d.Jobs.UpdateItem(ctx, itemID, "done", "")
                if r.em != nil { r.em.Emit("job.item.done", map[string]any{"job_id": jobID, "unit_id": u.ID, "key": u.Key, "locale": tgt, "text": txt, "model": p.Model}) }
            }
            done++
            _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
            if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "running", "model": p.Model}) }
        }
    }
    _ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
    if r.em != nil { r.em.Emit("job.progress", map[string]any{"job_id": jobID, "done": done, "total": total, "status": "done", "model": p.Model}) }
}

func (r *Runner) log(ctx context.Context, jobID int64, level, message string) {
    _ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: level, Message: message})
    if r.em != nil { r.em.Emit("job.log", map[string]any{"job_id": jobID, "level": level, "message": message, "ts": time.Now().UTC().Format(time.RFC3339)}) }
}

func (r *Runner) Cancel(jobID int64) bool {
    r.mu.Lock(); defer r.mu.Unlock()
    if cancel, ok := r.active[jobID]; ok { cancel(); delete(r.active, jobID); return true }
    return false
}
