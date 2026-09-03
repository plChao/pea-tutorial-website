first_line = input().split()
r = int(first_line[0])
c = int(first_line[1])

grid = [[0] * c for _ in range(r)]

k = int(input())
for i in range(k):
    parts = input().split()
    row = int(parts[0])
    col = int(parts[1])
    val = int(parts[2])
    grid[row][col] = val

for i in range(r):
    for j in range(c):
        print(grid[i][j], end=" ")
    print()
