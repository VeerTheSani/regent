# scripts/setup-vscode-profile.ps1
# Sets up dedicated VS Code profile for Regent with MCP bridge

Write-Host "Configuring Regent VS Code profile..."

$mcpJson = '{"name":"regent","type":"http","url":"http://127.0.0.1:7781/mcp"}'
& code --profile Regent --add-mcp $mcpJson 2>$null

Write-Host "VS Code Regent profile configured."
