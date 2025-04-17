import { DataTypes, Sequelize } from 'sequelize';



const sequelize = new Sequelize('warehouse_management', 'root', '', {
    host: 'localhost',
    port: 3306,
    dialect: 'mysql' /* one of 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'db2' | 'snowflake' | 'oracle' */
});

export const connectDB = () => {

    sequelize.sync().then(() => {
        console.log("database connected sucessfully");
    }).catch((error) => {
        console.log("unable to connect to database:" + error);
    });
};

export default sequelize;

