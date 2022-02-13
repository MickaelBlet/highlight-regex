# Highlight regex

### Example 1
```jsonc
"highlight.regex.regexs": [
    {
        "language": "c|cpp|java",
        "blocks": [
            {
                "regex": "/\\*[^]*?\\*/|//[^]*?(?:(?<!\\\\)$)",
                "regexFlag": "gm",
                "regexLimit": 25000
            }
        ],
        "regex": "\\b(TODO)\\b|\\b(TADA)\\b",
        "regexFlag": "gmi",
        "regexLimit": 25000,
        "decorations": [
            {
                "index": 1,
                "color": "#FFFFFF",
                "backgroundColor": "#FF990090",
                "border": "1px solid #FF990050",
                "borderRadius": "4px",
                "fontWeight": "bold",
                "overviewRulerColor": "#FF9900FF",
                "overviewRulerLane": 4
            },
            {
                "index": 2,
                "color": "#FFFFFF",
                "backgroundColor": "#FF000090",
                "border": "1px solid #FF000050",
                "borderRadius": "4px",
                "fontWeight": "bold",
                "overviewRulerColor": "#FF0000FF",
                "overviewRulerLane": 4
            }
        ]
    }
]
```
<p align="center">
  <img src="images/example1.jpg" >
</p>

### Example 2
```jsonc
"highlight-regex.regexs": [
    {
        "language": "c|cpp", // choose multi language
        "regex": "(?:['][^]*?(?:(?<!(?<!\\\\)\\\\)['])|[\"][^]*?(?:(?<!\\\\)[\"])|\\/\\*[^]*?\\*\\/|//[^]*?(?:(?<!\\\\)$)|#[^]*?(?:(?<!\\\\)$))|(\\b(?!__)_\\w+\\b)|(\\bthis\\b)", // regex string
        "regexFlag": "gm", // regex flag
        "regexLimit": 10000,
        "decorations": [
            {
                "index": 1,
                "fontWeight": "bold; text-shadow: 0px 0px 10px",
                "fontStyle": "italic"
            },
            {
                "index": 2,
                "fontWeight": "bold",
                "fontStyle": "italic; font-family: \"Ink Free\"; font-size:17.1px"
            }
        ]
    }
]
```

<p align="center">
  <img src="images/example2.jpg" >
</p>