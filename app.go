package main

import (
    "context"
    "fmt"
    jobsusecase "locail/internal/usecase/jobs"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
    ctx context.Context
    // db handle and other services will be added as we build
    runner *jobsusecase.Runner
}

// NewApp creates a new App application struct
func NewApp() *App {
    return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    if a.runner != nil {
        a.runner.SetEmitter(wailsEmitter{ctx: a.ctx})
    }
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
    return fmt.Sprintf("Hello %s, It's show time!", name)
}

// SetRunner allows main() to provide the job runner so we can wire event emitter on startup
func (a *App) SetRunner(r *jobsusecase.Runner) {
    a.runner = r
}

type wailsEmitter struct{ ctx context.Context }
func (w wailsEmitter) Emit(name string, payload any) {
    runtime.EventsEmit(w.ctx, name, payload)
}
