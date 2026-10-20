param(
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $false)][string]$Body = '',
  [switch]$Silent
)

# NOTE: keep this file pure ASCII. Windows PowerShell 5.1 decodes a .ps1 without a
# UTF-8 BOM as ANSI; non-ASCII comments then turn into garbage and a trailing byte
# can even swallow the next line. ASCII-only source is immune to that.

$ErrorActionPreference = 'Stop'

# WinRT types must be loaded explicitly under Windows PowerShell 5.1.
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

function ConvertTo-XmlText([string]$s) {
  if ($null -eq $s) { return '' }
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

$audioXml = if ($Silent) { '<audio silent="true" />' } else { '<audio src="ms-winsoundevent:Notification.Default" />' }

$xml = '<toast activationType="foreground" launch=""><visual><binding template="ToastGeneric"><text>' +
  (ConvertTo-XmlText $Title) + '</text><text>' + (ConvertTo-XmlText $Body) + '</text></binding></visual>' +
  $audioXml + '</toast>'

$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)

# Reuse the AUMID that Windows already registers for PowerShell, so no Start Menu
# shortcut registration is needed. Single backslashes are required.
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
Write-Output 'WINRT_OK'
