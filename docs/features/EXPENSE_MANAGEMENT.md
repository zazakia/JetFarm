# Expense Management

The Expense Management system provides a structured way to track operational costs, categorized for better financial analysis.

## Key Features
- **Dynamic Categories**: Admins can manage a list of expense categories (e.g., Office Supplies, Travel, Personnel).
- **Categorization**: Each expense recorded must be assigned to a category.
- **Frequency Options**: System supports tracking expenses as **Daily** or **Weekly**, facilitating recurring cost analysis.
- **Admin Management**: Admins can activate/deactivate categories through a dedicated Settings screen.

## Database Schema
The system uses the following tables:
- `app_expense_categories`: Stores category names and their active status (`is_active`).
- `app_expenses`: Individual expense entries, including:
  - `category`: Linked to the category name.
  - `frequency`: `daily`, `weekly`, or `one-time`.
  - `amount`: Cost.
  - `expense_date`: Timestamp.

## UI Components
- **Expense Categories Settings**: `app/(admin)/settings/expense-categories.tsx`.
- **Expense Encoder**: `app/(expenses-encoder)/index.tsx`. Fetches active categories from the database.

## Implementation Notes
- **User Context**: Expenses are tagged with an `encoded_by` field (standardized to UUID format).
- **Status Toggle**: Deactivating a category hides it from the encoder but preserves historical data.
