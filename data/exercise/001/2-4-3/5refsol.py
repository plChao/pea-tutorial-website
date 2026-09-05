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

for i in range(r):
    row_sum = 0
    for j in range(c):
        row_sum = row_sum + grid[i][j]
    print(row_sum)
