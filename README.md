# Inventory Manager

Inventory Manager is a robust and user-friendly application designed to streamline inventory tracking and management for businesses of all sizes. It allows users to add, update, delete, and monitor inventory items efficiently, providing essential insights and reporting for better decision-making.

## Technologies Used

- **Node.js** & **JavaScript**: Backend and business logic
- **HTML & CSS**: Frontend UI
- **Docker**: Containerized deployment
- **ESLint**: Code linting and style enforcement
- **E2E Tests**: End-to-end testing for reliability and robustness

## Features

- **Add, Edit, Remove Items:** Easily manage your inventory entries
- **Real-Time Stock Updates:** Track stock levels instantly
- **Reporting & Analytics:** Generate reports to analyze inventory trends
- **Search & Filter:** Quickly find items using search and filter tools
- **User Authentication:** Secure access for multiple users (if implemented)
- **Intuitive Interface:** Simple, clean, and responsive UI

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Olet-17/inventory-manager.git
   cd inventory-manager
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run ESLint**

   ```bash
   npm run lint
   ```

4. **Run E2E Tests**

   ```bash
   npm run test:e2e
   ```

5. **Start the application**

   ```bash
   npm start
   ```

6. **Using Docker (optional)**

   Build and run the application in a Docker container:

   ```bash
   docker build -t inventory-manager .
   docker run -p 3000:3000 inventory-manager
   ```

## Usage

- Access the dashboard to view inventory status
- Add new items by providing item details
- Edit or delete items as necessary
- Generate and export inventory reports

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

## Contact

For questions or feedback, please open an issue or reach out to [Olet-17](https://github.com/Olet-17).

---

*Inventory Manager - Simplifying inventory management for everyone.*
