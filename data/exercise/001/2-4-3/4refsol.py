first_line = input().split()
r = int(first_line[0])
c = int(first_line[1])

grid = []
for i in range(r):
    parts = input().split()
    row = []
    for p in parts:
        row.append(int(p))
    grid.append(row)

total = 0
for i in range(r):
    for j in range(c):
        total = total + grid[i][j]

print(total)
