class Example {
  public:
    Example():_var(42) {}
    Example(const Example& example):_var(example._var) {}
    ~Example() {}
    Example &operator=(const Example& example) {
        this->_var = example._var;
    }
  private:
    int _var;
};