# Runs build prompts (build-prompts.md) one after another, each in a fresh Claude Code session (same as /clear
# between them). No permission prompts. Commits to git after each successful milestone so any one can be rolled back.
# Needs: the `claude` CLI on PATH, and a git repo (git init; commit the kit first). Read CLAUDE.md section 10 first.
#
# Usage:   .\run-milestones.ps1 -Prompts 1,2,3
#          .\run-milestones.ps1 -Prompts 1B -MaxTurns 200
#          .\run-milestones.ps1 -Prompts "15D","16"    <- QUOTE ids with letters in a list. Unquoted, PowerShell reads
#                                                      15D as the decimal number 15 (D is the decimal suffix) and runs 15 again.
# A prompt that already has a milestone commit is skipped (with a warning) unless you pass -Force.
# Undo the last milestone:   git reset --hard HEAD~1
# See what a milestone changed:   git show --stat HEAD

param(
  [string[]]$Prompts = @("1"),
  [int]$MaxTurns = 150,
  [switch]$Force
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force "docs/run-logs" | Out-Null

foreach ($p in $Prompts) {
  # already built? (this is what catches 15D arriving here as 15: see Usage)
  $done = git log --oneline --fixed-strings --grep "Milestone: build prompt $p (autonomous)"
  if ($done -and -not $Force) {
    Write-Host "Prompt $p already has a milestone commit ($done) - skipping. Quote ids with letters; -Force runs it again." -ForegroundColor Yellow
    continue
  }
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  Write-Host "`n=== [$stamp] Build prompt $p ===" -ForegroundColor Cyan

  $task = @"
AUTONOMOUS MODE (see CLAUDE.md section 10).
Do build prompt $p from build-prompts.md, following CLAUDE.md. Read docs/design-log.md first to see
what earlier milestones built and decided. Do not ask questions: decide, and log each decision under
"Decisions to review". Finish with the milestone report and playtest questions, then stop.
"@

  $log = "docs/run-logs/prompt-$p.md"
  claude -p $task --dangerously-skip-permissions --max-turns $MaxTurns | Tee-Object -FilePath $log
  $code = $LASTEXITCODE

  if ($code -ne 0) {
    Write-Host "Prompt $p exited with code $code - stopping. Nothing committed for it; see $log" -ForegroundColor Red
    break
  }

  git add -A
  git commit -q -m "Milestone: build prompt $p (autonomous)"
  Write-Host "Prompt $p done and committed. Report: $log" -ForegroundColor Green
}

Write-Host "`nBatch finished. Review 'Decisions to review' in docs/design-log.md and the reports in docs/run-logs/."
