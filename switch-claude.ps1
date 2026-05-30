param (
    [string]$Model = "opus"
)

# Ensure console supports UTF-8 output for emojis and Cyrillic/special characters
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# Switcher for Claude Code configuration between Claude 4.6 Opus (direct) and DeepSeek V4 Pro (OpenRouter) via ProxyAPI

$settingsPath = "C:\Users\Artorius\.claude\settings.json"
$apiKey = "sk-zK4Ex3JBdMQ8D5YJ3XS2FOC0fXVbXSv2"

if ($Model -eq "opus" -or $Model -eq "claude") {
    $config = @{
        "effortLevel" = "medium"
        "model" = "opus"
        "env" = @{
            "ANTHROPIC_AUTH_TOKEN" = $apiKey
            "ANTHROPIC_BASE_URL" = "https://api.proxyapi.ru/anthropic"
        }
    }
    
    $configJson = $config | ConvertTo-Json -Depth 5
    Set-Content -Path $settingsPath -Value $configJson
    
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "[OPUS] Claude Code configured for Claude 4.6 Opus (Anthropic Direct)" -ForegroundColor Green
    Write-Host "Base URL: https://api.proxyapi.ru/anthropic" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan
}
elseif ($Model -eq "deepseek" -or $Model -eq "pro") {
    $config = @{
        "effortLevel" = "medium"
        "model" = "opus"
        "env" = @{
            "ANTHROPIC_AUTH_TOKEN" = $apiKey
            "ANTHROPIC_BASE_URL" = "https://api.proxyapi.ru/openrouter"
            "ANTHROPIC_DEFAULT_OPUS_MODEL" = "deepseek/deepseek-v4-pro"
            "ANTHROPIC_DEFAULT_SONNET_MODEL" = "deepseek/deepseek-v4-pro"
            "ANTHROPIC_DEFAULT_HAIKU_MODEL" = "deepseek/deepseek-v4-pro"
            "CLAUDE_CODE_SUBAGENT_MODEL" = "deepseek/deepseek-v4-pro"
        }
    }
    
    $configJson = $config | ConvertTo-Json -Depth 5
    Set-Content -Path $settingsPath -Value $configJson
    
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "[DEEPSEEK] Claude Code configured for DeepSeek V4 Pro (OpenRouter)" -ForegroundColor Green
    Write-Host "Base URL: https://api.proxyapi.ru/openrouter" -ForegroundColor Gray
    Write-Host "Mapped models: deepseek/deepseek-v4-pro" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan
}
else {
    Write-Host "❌ Unknown model! Use 'opus' (for Claude 4.6 Opus) or 'deepseek' (for DeepSeek V4 Pro)." -ForegroundColor Red
}
