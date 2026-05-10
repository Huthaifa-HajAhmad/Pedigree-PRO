# PowerShell wrapper for post-merge
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
node "$scriptDir\post-merge.js"
