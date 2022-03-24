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