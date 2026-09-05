stock = {"apple": 10, "banana": 5, "cherry": 0}
item = input()
print(item in stock)
print(stock.get(item, 0))
