import json

def get_net_change(val1, val2):
    return val2 - val1

# 2024 Closing Balances (Audited)
balances_2024 = {
    '1010': 39902.93,
    '1020': 53011.35,
    '1100': 164622.70,
    '1500': 117411.91,
    '2010': -116384.50,
    '2050': -559.15,
    '2060': -559.15,
    '2070': -186.38,
    '3010': -231907.27,
    '3020': -17094.77,
    '3030': -1366.41,
    '3040': -1647.38,
    '3050': -5243.88,
    '4010': -16260.00,
    '4020': -3620.00,
    '5000': 6814.31,
    '5110': 9338.00
}
diff = sum(balances_2024.values())
balances_2024['3060'] = -diff # Retained Surplus Plug to Balance
print("2024 Plug:", diff)

# 2025 Closing Balances (Audited)
balances_2025 = {
    '1010': 74083.93,
    '1020': 53220.33,
    '1100': 154522.70,
    '1500': 121399.90,
    '2010': -147542.85,
    '2050': -559.15,
    '2060': -559.15,
    '2070': -186.38,
    '3010': -231907.27,
    '3020': -15580.80,
    '3030': 0,
    '3040': -1647.38,
    '3050': -5243.88,
    '4010': -10500.00,
    '4020': -2300.00,
    '4030': -200.00,
    '4050': -78.62,
    '4060': -50.00,
    '5000': 7334.57,
    '5110': 7308.00
}

diff25 = sum(balances_2025.values())
balances_2025['3060'] = -diff25
print("2025 Plug:", diff25)

# Calculate NET CHANGES for 2025
net_changes_2025 = {}
for code in set(list(balances_2024.keys()) + list(balances_2025.keys())):
    val24 = balances_2024.get(code, 0)
    val25 = balances_2025.get(code, 0)
    
    # Revenue/Expenses do NOT accumulate into the next year. They are closed to Retained Earnings.
    # Therefore, the net change for Revenue/Expense is just their 2025 balance!
    if code.startswith('4') or code.startswith('5'):
        net_changes_2025[code] = val25
    elif code == '3060':
        # Retained Earnings 2025 = Retained Earnings 2024 + 2024 Net Income + 2025 Net Income
        # Let's just calculate the difference for the BS accounts
        pass
    else:
        net_changes_2025[code] = val25 - val24

# Let's balance 2025 Net Changes
# First sum all the BS changes and Rev/Exp
net_diff = sum(net_changes_2025.values())
net_changes_2025['3060'] = -net_diff

print("2025 Net Change Plug:", -net_diff)

with open('balances.json', 'w') as f:
    json.dump({'2024': balances_2024, '2025': net_changes_2025}, f, indent=2)

