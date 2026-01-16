---
name: python
description: Execute Python 3 code with common data libraries preinstalled.
category: development
defaultEnabled: true
mcp:
  type: sdk
  name: python
---

# Python Runner

This MCP provides a safe, no-shell Python execution tool for the current session workspace.

## Included libraries

- numpy
- pandas
- matplotlib
- pillow
- pyyaml
- scipy
- seaborn
- beautifulsoup4
- lxml

## Usage

Use the MCP tool `mcp__python__run` to execute Python code. The tool runs with the
session workspace as its working directory and returns stdout/stderr plus metadata.
