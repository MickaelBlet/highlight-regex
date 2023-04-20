# Highlight regex

Highlight (*decorate*) what you want with Regex in VS Code

**Examples** at [examples.md](examples.md)

## Regexes Settings

The regexes property is a object list.
The first objects can take a string list (**languageIds**) and object list (**regexes**).
**regexes** object properties:
- **regex**: string of regex
- **regexFlag**: flag of regex (default "gm")
- **regexLimit**: limit search of the **regex** property (default 50000)
- **decorations**: list of [VS Code decoration](https://code.visualstudio.com/api/references/vscode-api#DecorationRenderOptions) (with optionnal **index** property for indicate the index of match group of regex)
- **regexes**: object list of **regexes** (with optionnal **index** property for indicate the index of match group of regex)

### Default Regexes Setting
```jsonc
"highlight.regex.regexes": [
    {
        "languageIds": [ "c", "cpp", "go", "java", "javascript", "php", "rust", "typescript" ],
        "regexes": [
            {
                // regex to find all within comments
                "regex": "(/\\*[^]*?\\*/)|(//[^]*?(?:(?<!\\\\)$))",
                "regexFlag": "gm",
                "regexLimit": 25000,
                "regexes": [
                    {
                        "index": 0, // 0 for take all regex match (this is optionnal)
                        "regex": "\\b(TODO)\\b|\\b(TADA)\\b",
                        "regexFlag": "gmi",
                        "regexLimit": 25000,
                        "decorations": [
                             {
                                "index": 1, // index match regex group (TODO)
                                "borderRadius": "4px",
                                "fontWeight": "bold",
                                "overviewRulerColor": "#FF9900FF",
                                "overviewRulerLane": 4,
                                "light": {
                                    "color": "#000000",
                                    "backgroundColor": "#FF990050",
                                    "border": "1px solid #FF990090"
                                },
                                "dark": {
                                    "color": "#FFFFFF",
                                    "backgroundColor": "#FF990090",
                                    "border": "1px solid #FF990050"
                                }
                            },
                            {
                                "index": 2, // (TADA)
                                "borderRadius": "4px",
                                "fontWeight": "bold",
                                "overviewRulerColor": "#FF0000FF",
                                "overviewRulerLane": 4,
                                "light": {
                                    "color": "#000000",
                                    "backgroundColor": "#FF000050",
                                    "border": "1px solid #FF000090"
                                },
                                "dark": {
                                    "color": "#FFFFFF",
                                    "backgroundColor": "#FF990090",
                                    "border": "1px solid #FF990050"
                                }
                            }
                        ]
                    }
                ]
            }
        ]
    }
]
```
<p align="center">
  <img src="images/settingRegexes.drawio.png" >
</p>