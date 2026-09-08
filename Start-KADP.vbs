Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
shell.Run "node """ & root & "\core\server.mjs""", 0, False
WScript.Sleep 2000
shell.Run "http://127.0.0.1:4317", 1, False
