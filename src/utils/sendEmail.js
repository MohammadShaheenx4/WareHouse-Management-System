import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export async function sendEmail({ userEmail, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "hamode.sh889@gmail.com",  // Sender email from environment variables
            pass: "okim wwzy jqwe wmfv",  // App password from environment variables
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"Storify 👻" <${process.env.EMAIL_USER}>`, // Sender address
            to: userEmail, // Recipient email
            subject: subject, // Dynamic subject line
            text: text,  // Dynamic plain text body
            html: html,  // Dynamic HTML body
        });

        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email: ', error);
    }
}
