import { DataTypes, Sequelize } from 'sequelize';
/*
name:warehousemanagement
user:shaheen
pass:Gf85!m#atWCT6mB
host:pro.freedb.tech

*/
var x = 10;

const sequelize = new Sequelize('freedb_warehouse_management', 'freedb_shaheen', 'j8BQ#kt9jjDvh%8', {
    host: 'sql.freedb.tech',
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

