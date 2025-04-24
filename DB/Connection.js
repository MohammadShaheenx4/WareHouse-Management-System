import { DataTypes, Sequelize } from 'sequelize';
/*
name:warehousemanagement
user:shaheen
pass:Gf85!m#atWCT6mB
host:pro.freedb.tech

*/


const sequelize = new Sequelize('warehousemanagement', 'shaheen', 'Gf85!m#atWCT6mB', {
    host: 'pro.freedb.tech',
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

