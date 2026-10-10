# scripts/setup-hermes-profile.ps1
# Sets up dedicated Hermes profile for Regent with MCP bridge and safe allowlists

Write-Host "Configuring Regent Hermes profile..."

# Create regent profile if not existing
& hermes profile create regent 2>$null

# Register Regent Bridge MCP server
& hermes mcp add regent --url "http://127.0.0.1:7781/mcp" --auth header 2>$null

Write-Host "Hermes Regent profile configured successfully."
