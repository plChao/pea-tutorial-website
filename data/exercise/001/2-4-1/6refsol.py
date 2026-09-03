a = int(input())
b = int(input())
c = int(input())

if a > b:
    a, b = b, a
if b > c:
    b, c = c, b
if a > b:
    a, b = b, a

print(a, b, c)

if a + b <= c:
    print("不是三角形")
elif a * a + b * b < c * c:
    print("鈍角三角形")
elif a * a + b * b == c * c:
    print("直角三角形")
else:
    print("銳角三角形")
