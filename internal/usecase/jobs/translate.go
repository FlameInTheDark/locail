package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"locail/internal/adapters/llm/factory"
	"locail/internal/domain"
	"locail/internal/ports"
	"locail/internal/usecase/translator"
	"strings"
	"sync"
	"time"
)

type Deps struct {
	Jobs         ports.JobRepository
	Files        ports.FileRepository
	Units        ports.UnitRepository
	Providers    ports.ProviderRepository
	Translations ports.TranslationRepository
	Prompt       ports.PromptRenderer
	Cache        ports.CacheRepository
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

// Typed event payloads for clearer, comment-free code
type jobStartedPayload struct {
	JobID      int64  `json:"job_id"`
	Total      int    `json:"total"`
	Model      string `json:"model"`
	ProviderID int64  `json:"provider_id"`
}

type jobProgressPayload struct {
	JobID  int64  `json:"job_id"`
	Done   int    `json:"done"`
	Total  int    `json:"total"`
	Status string `json:"status"`
	Model  string `json:"model"`
}

type jobItemStartPayload struct {
	JobID  int64  `json:"job_id"`
	UnitID int64  `json:"unit_id"`
	Key    string `json:"key"`
	Locale string `json:"locale"`
	Model  string `json:"model"`
}

type jobItemDonePayload struct {
	JobID  int64  `json:"job_id"`
	UnitID int64  `json:"unit_id"`
	Key    string `json:"key"`
	Locale string `json:"locale"`
	Text   string `json:"text,omitempty"`
	Error  string `json:"error,omitempty"`
	Model  string `json:"model"`
}

type TranslateFileParams struct {
	FileID        int64    `json:"file_id"`
	TargetLocales []string `json:"target_locales"`
	Model         string   `json:"model"`
}

type TranslateUnitParams struct {
	UnitID  int64    `json:"unit_id"`
	Locales []string `json:"locales"`
	Model   string   `json:"model"`
	Force   bool     `json:"force"`
}

// TranslateUnitsParams describes a batch of specific units to translate sequentially.
type TranslateUnitsParams struct {
	UnitIDs []int64  `json:"unit_ids"`
	Locales []string `json:"locales"`
	Model   string   `json:"model"`
	Force   bool     `json:"force"`
}

func (r *Runner) StartTranslateFile(ctx context.Context, projectID, providerID int64, params TranslateFileParams) (int64, error) {
	params.Model = r.resolveModel(ctx, providerID, params.Model)
	paramsJSON, _ := json.Marshal(params)
	job := &domain.Job{Type: "translate_file", Status: "queued", ProjectID: &projectID, ProviderID: &providerID, ParamsRaw: string(paramsJSON), Progress: 0, Total: 0}
	jobID, err := r.d.Jobs.Create(ctx, job)
	if err != nil {
		return 0, err
	}
	units, _ := r.d.Units.ListByFile(ctx, params.FileID)
	total := 0
	for _, tgt := range params.TargetLocales {
		trs, _ := r.d.Translations.ListByFileLocale(ctx, params.FileID, tgt)
		have := make(map[int64]struct{}, len(trs))
		for _, t := range trs {
			have[t.UnitID] = struct{}{}
		}
		for _, u := range units {
			if _, ok := have[u.ID]; !ok {
				total++
			}
		}
	}
	_ = r.d.Jobs.UpdateProgress(ctx, jobID, 0, total, "running")
	r.emitStarted(jobID, total, params.Model, providerID)
	r.log(
		ctx,
		jobID,
		"info",
		fmt.Sprintf(
			"job started: provider=%d model=%s units=%d locales=%d",
			providerID,
			params.Model,
			len(units),
			len(params.TargetLocales),
		),
	)
	r.startAsync(jobID, func(runCtx context.Context) {
		r.runTranslateFile(runCtx, jobID, providerID, params)
	})
	return jobID, nil
}

// normalizeModel attempts to convert a possibly human-readable model label to a canonical ID
// for the specified provider. Returns the normalized model or empty string if unchanged.
func (r *Runner) normalizeModel(ctx context.Context, providerID int64, model string) (string, error) {
	m := model
	if strings.TrimSpace(m) == "" {
		return "", nil
	}
	prov, err := r.d.Providers.Get(ctx, providerID)
	if err != nil || prov == nil {
		return "", err
	}
	if strings.ToLower(prov.Type) != "openrouter" {
		return "", nil
	}
	// Heuristic: labels usually have spaces/parentheses; IDs don't
	if !strings.Contains(m, " ") && !strings.Contains(m, "(") && !strings.Contains(m, ")") {
		return "", nil // likely already an ID
	}
	adapter, ok := factory.FromProvider(prov)
	if !ok {
		return "", nil
	}
	list, err := adapter.ListModels(ctx)
	if err != nil {
		return "", err
	}
	for _, mi := range list {
		if strings.EqualFold(mi.Name, m) || strings.EqualFold(mi.Description, m) {
			return mi.Name, nil
		}
	}
	return "", nil
}

// resolveModel returns an effective model: provider default if empty, then normalized if needed.
func (r *Runner) resolveModel(ctx context.Context, providerID int64, model string) string {
	out := strings.TrimSpace(model)
	if out == "" {
		if prov, err := r.d.Providers.Get(ctx, providerID); err == nil && prov != nil {
			out = prov.Model
		}
	}
	if norm, err := r.normalizeModel(ctx, providerID, out); err == nil && norm != "" {
		out = norm
	}
	return out
}

// startAsync stores a cancel func and runs fn in a new goroutine with a cancellable context.
func (r *Runner) startAsync(jobID int64, fn func(ctx context.Context)) {
	cctx, cancel := context.WithCancel(context.Background())
	r.mu.Lock()
	r.active[jobID] = cancel
	r.mu.Unlock()
	go fn(cctx)
}

func (r *Runner) emitStarted(jobID int64, total int, model string, providerID int64) {
	if r.em == nil {
		return
	}
	payload := jobStartedPayload{JobID: jobID, Total: total, Model: model, ProviderID: providerID}
	r.em.Emit(
		"job.started",
		payload,
	)
}

func (r *Runner) emitProgress(jobID int64, done, total int, status, model string) {
	if r.em == nil {
		return
	}
	payload := jobProgressPayload{JobID: jobID, Done: done, Total: total, Status: status, Model: model}
	r.em.Emit(
		"job.progress",
		payload,
	)
}

func (r *Runner) beginJobItem(ctx context.Context, jobID int64, u *domain.Unit, locale, model string) int64 {
	item := &domain.JobItem{JobID: jobID, UnitID: &u.ID, Locale: &locale, Status: "running"}
	itemID, _ := r.d.Jobs.AddItem(ctx, item)
	if r.em != nil {
		payload := jobItemStartPayload{
			JobID:  jobID,
			UnitID: u.ID,
			Key:    u.Key,
			Locale: locale,
			Model:  model,
		}
		r.em.Emit(
			"job.item.start",
			payload,
		)
	}
	r.log(
		ctx,
		jobID,
		"info",
		fmt.Sprintf(
			"translate start: key=%s locale=%s model=%s",
			u.Key,
			locale,
			model,
		),
	)
	return itemID
}

func (r *Runner) endJobItemSuccess(ctx context.Context, jobID, itemID int64, u *domain.Unit, locale, model, text string) {
	tr := &domain.Translation{UnitID: u.ID, Locale: locale, Text: text, Status: "machine"}
	_ = r.d.Translations.Upsert(ctx, tr)
	_ = r.d.Jobs.UpdateItem(ctx, itemID, "done", "")
	if r.em != nil {
		payload := jobItemDonePayload{JobID: jobID, UnitID: u.ID, Key: u.Key, Locale: locale, Text: text, Model: model}
		r.em.Emit(
			"job.item.done",
			payload,
		)
	}
	r.log(
		ctx,
		jobID,
		"info",
		fmt.Sprintf(
			"translate done: key=%s locale=%s len=%d",
			u.Key,
			locale,
			len(text),
		),
	)
}

func (r *Runner) endJobItemError(ctx context.Context, jobID, itemID int64, u *domain.Unit, locale, model string, err error) {
	_ = r.d.Jobs.UpdateItem(ctx, itemID, "failed", err.Error())
	_ = r.d.Jobs.AddLog(
		ctx,
		&domain.JobLog{
			JobID:   jobID,
			Level:   "error",
			Message: fmt.Sprintf("%s -> %s: %v", u.Key, locale, err),
		},
	)
	if r.em != nil {
		payload := jobItemDonePayload{
			JobID:  jobID,
			UnitID: u.ID,
			Key:    u.Key,
			Locale: locale,
			Error:  err.Error(),
			Model:  model,
		}
		r.em.Emit(
			"job.item.done",
			payload,
		)
	}
}

func (r *Runner) translateWithTimeout(ctx context.Context, providerID int64, u *domain.Unit, locale, model string, bypass bool) (string, error) {
	ictx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	return r.trans.TranslateOne(
		ictx,
		translator.TranslateArgs{
			ProviderID:  providerID,
			Unit:        u,
			SourceLang:  "",
			TargetLang:  locale,
			Model:       model,
			BypassCache: bypass,
		},
	)
}

func (r *Runner) runTranslateFile(ctx context.Context, jobID, providerID int64, p TranslateFileParams) {
	units, err := r.d.Units.ListByFile(ctx, p.FileID)
	if err != nil {
		_ = r.d.Jobs.AddLog(
			ctx,
			&domain.JobLog{JobID: jobID, Level: "error", Message: err.Error()},
		)
		_ = r.d.Jobs.UpdateProgress(
			ctx,
			jobID,
			0,
			0,
			"failed",
		)
		return
	}
	_ = r.d.Jobs.AddLog(
		ctx,
		&domain.JobLog{
			JobID:   jobID,
			Level:   "info",
			Message: fmt.Sprintf("units=%d, locales=%d", len(units), len(p.TargetLocales)),
		},
	)
	total, done := len(units)*len(p.TargetLocales), 0
	_ = r.d.Jobs.UpdateProgress(
		ctx,
		jobID,
		done,
		total,
		"running",
	)
	for _, u := range units {
		select {
		case <-ctx.Done():
			_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled")
			return
		default:
		}
		for _, locale := range p.TargetLocales {
			t, _ := r.d.Translations.Get(ctx, u.ID, locale)
			if t != nil && strings.TrimSpace(t.Text) != "" {
				continue
			}
			itemID := r.beginJobItem(ctx, jobID, u, locale, p.Model)
			txt, trErr := r.translateWithTimeout(ctx, providerID, u, locale, p.Model, false)
			if trErr != nil {
				r.endJobItemError(ctx, jobID, itemID, u, locale, p.Model, trErr)
			} else {
				r.endJobItemSuccess(ctx, jobID, itemID, u, locale, p.Model, txt)
			}
			done++
			_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
			r.emitProgress(jobID, done, total, "running", p.Model)
		}
	}
	_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
	r.emitProgress(jobID, done, total, "done", p.Model)
}

// StartTranslateUnit creates a job to translate a single unit for given locales, skipping those that already have a translation.
func (r *Runner) StartTranslateUnit(ctx context.Context, projectID, providerID int64, p TranslateUnitParams) (int64, error) {
	// Resolve model: if empty, use provider default
	if p.Model == "" {
		if prov, err := r.d.Providers.Get(ctx, providerID); err == nil && prov != nil {
			p.Model = prov.Model
		}
	}
	if norm, err := r.normalizeModel(ctx, providerID, p.Model); err == nil && norm != "" {
		p.Model = norm
	}
	// Compute locales to process: all if Force, else only missing
	miss := make([]string, 0, len(p.Locales))
	if p.Force {
		miss = append(miss, p.Locales...)
	} else {
		for _, tgt := range p.Locales {
			t, _ := r.d.Translations.Get(ctx, p.UnitID, tgt)
			if t == nil || strings.TrimSpace(t.Text) == "" {
				miss = append(miss, tgt)
			}
		}
	}
	paramsJSON, _ := json.Marshal(p)
	job := &domain.Job{
		Type:       "translate_unit",
		Status:     "queued",
		ProjectID:  &projectID,
		ProviderID: &providerID,
		ParamsRaw:  string(paramsJSON),
		Progress:   0,
		Total:      len(miss),
	}
	id, err := r.d.Jobs.Create(ctx, job)
	if err != nil {
		return 0, err
	}
	_ = r.d.Jobs.UpdateProgress(ctx, id, 0, len(miss), "running")
	r.emitStarted(id, len(miss), p.Model, providerID)
	r.log(
		ctx,
		id,
		"info",
		fmt.Sprintf(
			"job started: provider=%d model=%s unit=%d locales=%d",
			providerID,
			p.Model,
			p.UnitID,
			len(miss),
		),
	)
	cctx, cancel := context.WithCancel(context.Background())
	r.mu.Lock()
	r.active[id] = cancel
	r.mu.Unlock()
	go r.runTranslateUnit(cctx, id, providerID, p, miss)
	return id, nil
}

func (r *Runner) runTranslateUnit(ctx context.Context, jobID, providerID int64, p TranslateUnitParams, locales []string) {
	u, err := r.d.Units.Get(ctx, p.UnitID)
	if err != nil || u == nil {
		_ = r.d.Jobs.UpdateProgress(ctx, jobID, 0, 0, "failed")
		return
	}
	total, done := len(locales), 0
	for _, locale := range locales {
		select {
		case <-ctx.Done():
			_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled")
			return
		default:
		}
		itemID := r.beginJobItem(ctx, jobID, u, locale, p.Model)
		txt, trErr := r.translateWithTimeout(ctx, providerID, u, locale, p.Model, p.Force)
		if trErr != nil {
			r.endJobItemError(ctx, jobID, itemID, u, locale, p.Model, trErr)
		} else {
			r.endJobItemSuccess(ctx, jobID, itemID, u, locale, p.Model, txt)
		}
		done++
		_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
		r.emitProgress(jobID, done, total, "running", p.Model)
	}
	_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
	r.emitProgress(jobID, done, total, "done", p.Model)
}

// StartTranslateUnits creates a single job to translate multiple specific units sequentially for given locales.
func (r *Runner) StartTranslateUnits(ctx context.Context, projectID, providerID int64, p TranslateUnitsParams) (int64, error) {
	// Resolve/normalize model
	p.Model = r.resolveModel(ctx, providerID, p.Model)
	// Compute total items: all if Force, else only missing
	total := 0
	if p.Force {
		total = len(p.UnitIDs) * len(p.Locales)
	} else {
		for _, uid := range p.UnitIDs {
			for _, tgt := range p.Locales {
				t, _ := r.d.Translations.Get(ctx, uid, tgt)
				if t == nil || strings.TrimSpace(t.Text) == "" {
					total++
				}
			}
		}
	}
	paramsJSON, _ := json.Marshal(p)
	job := &domain.Job{
		Type:       "translate_units",
		Status:     "queued",
		ProjectID:  &projectID,
		ProviderID: &providerID,
		ParamsRaw:  string(paramsJSON),
		Progress:   0,
		Total:      total,
	}
	id, err := r.d.Jobs.Create(ctx, job)
	if err != nil {
		return 0, err
	}
	_ = r.d.Jobs.UpdateProgress(ctx, id, 0, total, "running")
	r.emitStarted(id, total, p.Model, providerID)
	r.startAsync(
		id,
		func(runCtx context.Context) {
			r.runTranslateUnits(
				runCtx,
				id,
				providerID,
				p,
			)
		},
	)
	return id, nil
}

func (r *Runner) runTranslateUnits(ctx context.Context, jobID, providerID int64, p TranslateUnitsParams) {
	done, total := 0, 0
	for range p.UnitIDs {
		for range p.Locales {
			total++
		}
	}
	for _, uid := range p.UnitIDs {
		select {
		case <-ctx.Done():
			_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "canceled")
			return
		default:
		}
		u, err := r.d.Units.Get(ctx, uid)
		if err != nil || u == nil {
			continue
		}
		for _, locale := range p.Locales {
			if !p.Force {
				t, _ := r.d.Translations.Get(ctx, u.ID, locale)
				if t != nil && strings.TrimSpace(t.Text) != "" {
					continue
				}
			}
			itemID := r.beginJobItem(ctx, jobID, u, locale, p.Model)
			txt, trErr := r.translateWithTimeout(ctx, providerID, u, locale, p.Model, p.Force)
			if trErr != nil {
				r.endJobItemError(ctx, jobID, itemID, u, locale, p.Model, trErr)
			} else {
				r.endJobItemSuccess(ctx, jobID, itemID, u, locale, p.Model, txt)
			}
			done++
			_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "running")
			r.emitProgress(jobID, done, total, "running", p.Model)
		}
	}
	_ = r.d.Jobs.UpdateProgress(ctx, jobID, done, total, "done")
	r.emitProgress(jobID, done, total, "done", p.Model)
}

func (r *Runner) log(ctx context.Context, jobID int64, level, message string) {
	_ = r.d.Jobs.AddLog(ctx, &domain.JobLog{JobID: jobID, Level: level, Message: message})
	if r.em != nil {
		payload := struct {
			JobID   int64  `json:"job_id"`
			Level   string `json:"level"`
			Message string `json:"message"`
			Ts      string `json:"ts"`
		}{JobID: jobID, Level: level, Message: message, Ts: time.Now().UTC().Format(time.RFC3339)}
		r.em.Emit("job.log", payload)
	}
}

func (r *Runner) Cancel(jobID int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if cancel, ok := r.active[jobID]; ok {
		cancel()
		delete(r.active, jobID)
		return true
	}
	return false
}
