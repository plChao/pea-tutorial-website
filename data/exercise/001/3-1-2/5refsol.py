s = input()
k = int(input())

result = ""
for ch in s:
    code = (ord(ch) - ord('a') + k) % 26 + ord('a')
    result = result + chr(code)

print(result)
