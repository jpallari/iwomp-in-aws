// A program for executing scripts on Git repos based on data in SSM.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ssm"
	git "github.com/go-git/go-git/v5"
	gitPlumbing "github.com/go-git/go-git/v5/plumbing"
	gitTransport "github.com/go-git/go-git/v5/plumbing/transport"
	gitHTTP "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/kelseyhightower/envconfig"
)

type appConfig struct {
	ConfigPath  string `default:"iwomp-in-aws"`
	ProjectName string `required:"true"`
	GitBranch   string `required:"true"`
}

func (c *appConfig) defaultPath() string {
	return fmt.Sprintf("/%s/_default", c.ConfigPath)
}

func (c *appConfig) projectPath() string {
	return fmt.Sprintf("/%s/%s", c.ConfigPath, c.ProjectName)
}

func (c *appConfig) load() error {
	return envconfig.Process("", c)
}

type projectConfig struct {
	GitURL        string `json:"gitUrl"`
	AuthToken     string `json:"authToken"`
	BasicUsername string `json:"basicUsername"`
	BasicPassword string `json:"basicPassword"`
	DeployDir     string `json:"deployDir"`
	Command       string `json:"command"`
}

func (c *projectConfig) load(ac *appConfig, sess *session.Session) error {
	ssmSVC := ssm.New(sess)

	// Load defaults first
	{
		defaultPath := ac.defaultPath()
		defaultsOut, err := ssmSVC.GetParameter(&ssm.GetParameterInput{
			Name:           aws.String(defaultPath),
			WithDecryption: aws.Bool(true),
		})
		if err == nil {
			if err := c.loadFromParameter(defaultsOut.Parameter); err != nil {
				log.Printf("failed to load defaults from SSM path %s: %s", defaultPath, err)
			}
		} else {
			log.Printf("failed to fetch defaults from SSM path %s: %s", defaultPath, err)
		}
	}

	// Load the project details second
	projectPath := ac.projectPath()
	projectOut, err := ssmSVC.GetParameter(&ssm.GetParameterInput{
		Name:           aws.String(projectPath),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		return fmt.Errorf("failed to fetch from SSM path %s: %s", projectPath, err)
	}
	if err := c.loadFromParameter(projectOut.Parameter); err != nil {
		return fmt.Errorf("failed to load from SSM path %s: %s", projectPath, err)
	}

	// Fill in the gaps
	if c.DeployDir == "" {
		c.DeployDir = "."
	}

	// Validate
	if c.GitURL == "" {
		return fmt.Errorf("no Git URL specified for project %s", ac.ProjectName)
	}
	if c.Command == "" {
		return fmt.Errorf("no command specified for project %s", ac.ProjectName)
	}

	return nil
}

func (c *projectConfig) loadFromParameter(parameter *ssm.Parameter) error {
	return json.Unmarshal([]byte(*parameter.Value), c)
}

func (c *projectConfig) gitAuth() gitTransport.AuthMethod {
	if c.AuthToken != "" {
		return &gitHTTP.TokenAuth{
			Token: c.AuthToken,
		}
	}
	if c.BasicPassword != "" {
		return &gitHTTP.BasicAuth{
			Username: c.BasicUsername,
			Password: c.BasicPassword,
		}
	}

	return nil
}

func (c *projectConfig) run(appConf *appConfig) error {
	cmd := exec.Command(c.Command, appConf.GitBranch)
	cmd.Dir = c.DeployDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func main() {
	if err := mainWithErr(); err != nil {
		log.Fatalf("iwomp-in-aws: %s", err)
	}
}

func mainWithErr() error {
	// Load app config
	var appConf appConfig
	if err := appConf.load(); err != nil {
		return err
	}

	// Start AWS session
	sess, err := session.NewSession(&aws.Config{})
	if err != nil {
		return err
	}

	// Load config for the project
	var projectConf projectConfig
	if err := projectConf.load(&appConf, sess); err != nil {
		return err
	}

	// Clone repo for the project based on app config
	if err := cloneRepository(&appConf, &projectConf); err != nil {
		return err
	}

	// Run the project command
	return projectConf.run(&appConf)
}

func cloneRepository(appConf *appConfig, projectConf *projectConfig) error {
	log.Printf("cloning repo %s branch %s", projectConf.GitURL, appConf.GitBranch)

	_, err := git.PlainClone(".", false, &git.CloneOptions{
		URL:           projectConf.GitURL,
		Auth:          projectConf.gitAuth(),
		ReferenceName: gitPlumbing.NewBranchReferenceName(appConf.GitBranch),
		SingleBranch:  true,
		Progress:      os.Stdout,
		Depth:         1,
	})
	return err
}
