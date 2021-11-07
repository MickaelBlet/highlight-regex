# MBLET REGEX HIGHLIGHT

<p align="center">
  <img src="images/example.png" >
</p>

```json
"mblet-regex-hightlight.regex": [
    {
        "language": "c|cpp",
        "regex": "(?:['][^]*?(?:(?<!(?<!\\\\)\\\\)['])|[\"][^]*?(?:(?<!\\\\)[\"])|\\/\\*[^]*?\\*\\/|//[^]*?(?:(?<!\\\\)$)|#[^]*?(?:(?<!\\\\)$))|(\\b(?!__)_\\w+\\b)|(\\bthis\\b)",
        "regexFlags": "gm",
        "limit": 10000,
        "css": [
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
  <img src="images/example2.png" >
</p>