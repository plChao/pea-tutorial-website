target = int(input())

count = 0
found = False
while True:
    g = int(input())
    if g == -1:
        break
    count = count + 1
    if g == target:
        found = True
        break

if found:
    print("猜對了，共猜了", count, "次")
else:
    print("放棄")
