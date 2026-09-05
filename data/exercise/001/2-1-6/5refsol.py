a = [1, 2, 3]
b = a
print(a is b)
b.append(4)
print(a)
c = a[:]
print(a is c)
c.append(99)
print(a)
