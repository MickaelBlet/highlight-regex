class Example {
  public:
    Example():_var(42) {}
    Example(const Example& example) {
        if (this == &example)
            return ;
        *this = example;
    }
    ~Example() {}
    Example &operator=(const Example &example) {
        if (this == &example)
            return *this;
        this->_var = example._var;
    }
  private:
    int _var;
};

// "mblet-regex-hightlight.regex": [
//     {
//         "language": "c|cpp",
//         "regex": "(?:['][^]*?(?:(?<!(?<!\\\\)\\\\)['])|[\"][^]*?(?:(?<!\\\\)[\"])|\\/\\*[^]*?\\*\\/|//[^]*?(?:(?<!\\\\)$)|#[^]*?(?:(?<!\\\\)$))|(\\b(?!__)_\\w+\\b)|(\\bthis\\b)",
//         "regexFlags": "gm",
//         "limit": 10000,
//         "css": [
//             {
//                 "index": 1,
//                 "fontWeight": "bold; text-shadow: 0px 0px 10px",
//                 "fontStyle": "italic"
//             },
//             {
//                 "index": 2,
//                 "fontWeight": "bold",
//                 "fontStyle": "italic; font-family: \"Ink Free\"; font-size:17.1px"
//             }
//         ]
//     }
// ]